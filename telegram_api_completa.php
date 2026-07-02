<?php
date_default_timezone_set('America/Sao_Paulo');
require 'db.php';

header('Content-Type: application/json; charset=utf-8');

// ==================== CRIAR TABELAS ====================
try {
    // Tabela de usuários do Telegram
    $pdo->exec("CREATE TABLE IF NOT EXISTS telegram_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT NOT NULL UNIQUE,
        username VARCHAR(255),
        first_name VARCHAR(255),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_access DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    
    // Tabela de logs de ações
    $pdo->exec("CREATE TABLE IF NOT EXISTS telegram_actions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT,
        action VARCHAR(50),
        details JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES telegram_users(user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Exception $e) {}

// ==================== ADICIONAR COLUNA IN_USE ====================
try {
    $existe = $pdo->query("SHOW COLUMNS FROM m3u_accounts LIKE 'in_use'")->fetch();
    if (!$existe) {
        $pdo->exec("ALTER TABLE m3u_accounts ADD COLUMN in_use TINYINT(1) DEFAULT 0");
    }
} catch (Exception $e) {}

// ==================== HELPER FUNCTIONS ====================
function logAction($userId, $action, $details = []) {
    global $pdo;
    try {
        $stmt = $pdo->prepare("INSERT INTO telegram_actions (user_id, action, details) VALUES (?, ?, ?)");
        $stmt->execute([$userId, $action, json_encode($details)]);
    } catch (Exception $e) {}
}

function getAction() {
    return $_GET['action'] ?? '';
}

function getParam($name, $default = null) {
    $data = json_decode(file_get_contents('php://input'), true) ?? [];
    return $data[$name] ?? $_GET[$name] ?? $default;
}

function response($ok, $data = [], $erro = '') {
    $result = ['ok' => $ok];
    if ($ok) {
        $result = array_merge($result, $data);
    } else {
        $result['erro'] = $erro;
    }
    echo json_encode($result);
    exit;
}

// ==================== AÇÕES ====================
$action = getAction();

// ============ GET SERVERS ============
if ($action === 'get_servers') {
    try {
        $servers = $pdo->query("
            SELECT DISTINCT host, COUNT(*) as count 
            FROM m3u_accounts 
            WHERE status_conta != 'bloqueada'
            GROUP BY host
            ORDER BY host
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        response(true, ['servers' => $servers]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ GET ACCOUNTS ============
if ($action === 'get_accounts') {
    $host = getParam('host');
    $page = (int)(getParam('page', 1));
    $por_pagina = 10;
    $offset = ($page - 1) * $por_pagina;
    
    if (empty($host)) {
        response(false, [], 'Host não fornecido');
    }
    
    try {
        $total = $pdo->query("SELECT COUNT(*) FROM m3u_accounts WHERE host = " . $pdo->quote($host))->fetchColumn();
        $contas = $pdo->query("
            SELECT 
                id, host, username, password, criada, expira, 
                max_con, con_ativas, dias_restantes, m3u_url, in_use
            FROM m3u_accounts 
            WHERE host = " . $pdo->quote($host) . "
            ORDER BY id DESC
            LIMIT $offset, $por_pagina
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        $pages = ceil($total / $por_pagina);
        
        response(true, [
            'contas' => $contas,
            'page' => $page,
            'pages' => $pages,
            'total' => $total
        ]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ FORMAT ACCOUNT ============
if ($action === 'format_account') {
    $id = (int)getParam('id', 0);
    
    if ($id <= 0) {
        response(false, [], 'ID inválido');
    }
    
    try {
        $conta = $pdo->query("SELECT * FROM m3u_accounts WHERE id = $id")->fetch(PDO::FETCH_ASSOC);
        
        if (!$conta) {
            response(false, [], 'Conta não encontrada');
        }
        
        response(true, ['conta' => $conta]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ REGISTER USER ============
if ($action === 'register_user') {
    $user_id = (int)getParam('user_id', 0);
    $username = getParam('username', 'N/A');
    $first_name = getParam('first_name', 'N/A');
    
    if ($user_id <= 0) {
        response(false, [], 'User ID inválido');
    }
    
    try {
        $stmt = $pdo->prepare("
            INSERT INTO telegram_users (user_id, username, first_name) 
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE last_access = NOW()
        ");
        $stmt->execute([$user_id, $username, $first_name]);
        
        logAction($user_id, 'login', [
            'username' => $username,
            'first_name' => $first_name
        ]);
        
        response(true, ['mensagem' => 'Usuário registrado']);
    } catch (Exception $e) {
        response(true, ['mensagem' => 'Usuário processado']);
    }
}

// ============ MARK IN USE ============
if ($action === 'mark_in_use') {
    $id = (int)getParam('id', 0);
    $in_use = (int)getParam('in_use', 0);
    $user_id = (int)getParam('user_id', 0);
    
    if ($id <= 0) {
        response(false, [], 'ID inválido');
    }
    
    try {
        $stmt = $pdo->prepare("UPDATE m3u_accounts SET in_use = ? WHERE id = ?");
        $stmt->execute([$in_use, $id]);
        
        logAction($user_id, $in_use ? 'mark_in_use' : 'mark_unused', ['account_id' => $id]);
        
        $status = $in_use ? 'em uso' : 'não usada';
        response(true, ['mensagem' => "Conta marcada como $status"]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ DELETE SERVER ============
if ($action === 'delete_server') {
    $host = getParam('host');
    $user_id = (int)getParam('user_id', 0);
    
    if (empty($host)) {
        response(false, [], 'Host não fornecido');
    }
    
    try {
        $stmt = $pdo->prepare("DELETE FROM m3u_accounts WHERE host = ?");
        $stmt->execute([$host]);
        $deleted = $stmt->rowCount();
        
        logAction($user_id, 'delete_server', ['host' => $host, 'contas_deletadas' => $deleted]);
        
        response(true, [
            'mensagem' => "Servidor deletado com sucesso",
            'deletadas' => $deleted
        ]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ IMPORT ACCOUNTS (TXT) ============
if ($action === 'import_accounts') {
    $file_content = getParam('content');
    $host = getParam('host');
    $user_id = (int)getParam('user_id', 0);
    
    if (empty($file_content) || empty($host)) {
        response(false, [], 'Arquivo ou host não fornecido');
    }
    
    try {
        $lines = explode("\n", trim($file_content));
        $imported = 0;
        $errors = 0;
        
        $stmt = $pdo->prepare("
            INSERT INTO m3u_accounts 
            (host, username, password, criada, expira, max_con, con_ativas, dias_restantes, m3u_url, in_use)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            ON DUPLICATE KEY UPDATE 
            password = VALUES(password), 
            expira = VALUES(expira),
            max_con = VALUES(max_con)
        ");
        
        foreach ($lines as $line) {
            $line = trim($line);
            if (empty($line) || strpos($line, ':') === false) continue;
            
            // Formato esperado: user:pass:expira:max_con
            $parts = explode(':', $line);
            if (count($parts) < 2) continue;
            
            $username = trim($parts[0]);
            $password = trim($parts[1]);
            $expira = isset($parts[2]) ? trim($parts[2]) : null;
            $max_con = isset($parts[3]) ? (int)trim($parts[3]) : 1;
            
            try {
                $stmt->execute([
                    $host,
                    $username,
                    $password,
                    date('Y-m-d H:i:s'),
                    $expira,
                    $max_con,
                    0,
                    0,
                    ""
                ]);
                $imported++;
            } catch (Exception $e) {
                $errors++;
            }
        }
        
        logAction($user_id, 'import_accounts', [
            'host' => $host,
            'imported' => $imported,
            'errors' => $errors
        ]);
        
        response(true, [
            'mensagem' => "Importação concluída",
            'importadas' => $imported,
            'erros' => $errors
        ]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ GET STATS ============
if ($action === 'get_stats') {
    try {
        $totalServers = $pdo->query("SELECT COUNT(DISTINCT host) FROM m3u_accounts")->fetchColumn();
        $totalContas = $pdo->query("SELECT COUNT(*) FROM m3u_accounts")->fetchColumn();
        $contasEmUso = $pdo->query("SELECT COUNT(*) FROM m3u_accounts WHERE in_use = 1")->fetchColumn();
        $contasVencidas = $pdo->query("SELECT COUNT(*) FROM m3u_accounts WHERE dias_restantes <= 0")->fetchColumn();
        
        response(true, [
            'servidores' => $totalServers,
            'contas_total' => $totalContas,
            'contas_em_uso' => $contasEmUso,
            'contas_vencidas' => $contasVencidas
        ]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ GET USER HISTORY ============
if ($action === 'get_user_history') {
    $user_id = (int)getParam('user_id', 0);
    
    if ($user_id <= 0) {
        response(false, [], 'User ID inválido');
    }
    
    try {
        $history = $pdo->query("
            SELECT * FROM telegram_actions 
            WHERE user_id = $user_id 
            ORDER BY created_at DESC 
            LIMIT 50
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        response(true, ['history' => $history]);
    } catch (Exception $e) {
        response(false, [], $e->getMessage());
    }
}

// ============ ERROR: ACTION NOT FOUND ============
response(false, [], 'Ação não encontrada');
?>
