<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: https://congresohela.com');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzD29sjjWWqFho8cZSd8CMmeMHMY0nx19_2mkDoIVMDqx4F4ktfJ27xerhoz7JyfpLM/exec';

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

$curl = curl_init(APP_SCRIPT_URL);
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