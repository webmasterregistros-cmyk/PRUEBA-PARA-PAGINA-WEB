
<?php
const URL_APPSCRIPT = 'https://script.google.com/macros/s/AKfycbwR9mLwZS380hPQ0FT_FQKiBBF-czItthuTuBD-Kbku2vDaQ85lLvBTKhcSWQ5VKjYb/exec';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$payload = file_get_contents('php://input');
if (!$payload) {
    http_response_code(400);
    echo json_encode(['error' => 'Solicitud vacía']);
    exit;
}

$curl = curl_init(URL_APPSCRIPT);
curl_setopt_array($curl, [
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 60
]);

$respuesta = curl_exec($curl);
$error = curl_error($curl);
$codigo = curl_getinfo($curl, CURLINFO_HTTP_CODE);
curl_close($curl);

if ($error) {
    http_response_code(502);
    echo json_encode(['error' => 'No se pudo conectar con Apps Script.']);
    exit;
}

http_response_code($codigo >= 200 && $codigo < 500 ? $codigo : 502);
echo $respuesta;
?>