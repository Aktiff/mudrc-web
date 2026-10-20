<?php
declare(strict_types=1);

$configPath = __DIR__ . "/media-config.php";
$config = is_file($configPath) ? require $configPath : null;
$secret = is_array($config) ? (string) ($config["secret"] ?? "") : "";
$publicBase = is_array($config) ? (string) ($config["public_base"] ?? "https://media.mudrc.sk") : "https://media.mudrc.sk";

$origin = isset($_SERVER["HTTP_ORIGIN"]) ? (string) $_SERVER["HTTP_ORIGIN"] : "";
$allowedOrigins = [
  "https://www.mudrc.sk",
  "https://mudrc.sk",
  "http://localhost:3000",
];
if (in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: " . $origin);
  header("Vary: Origin");
} else {
  header("Access-Control-Allow-Origin: https://www.mudrc.sk");
}
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

if (($_SERVER["REQUEST_METHOD"] ?? "") === "OPTIONS") {
  http_response_code(204);
  exit;
}

function fail(int $code, string $message): void {
  http_response_code($code);
  header("Content-Type: application/json; charset=utf-8");
  echo json_encode(["error" => $message], JSON_UNESCAPED_UNICODE);
  exit;
}

function b64url_decode(string $data): string {
  $data = strtr($data, "-_", "+/");
  $pad = strlen($data) % 4;
  if ($pad > 0) {
    $data .= str_repeat("=", 4 - $pad);
  }
  $out = base64_decode($data, true);
  return $out === false ? "" : $out;
}

if (($_SERVER["REQUEST_METHOD"] ?? "") !== "POST") {
  fail(405, "Nepodporovaná metóda.");
}
if ($secret === "" || strpos($secret, "SEM_DAJ") === 0) {
  fail(500, "Na hostingu chýba heslo v media-config.php.");
}

$token = isset($_POST["token"]) ? (string) $_POST["token"] : "";
$parts = explode(".", $token, 2);
if (count($parts) !== 2) {
  fail(403, "Neplatný token.");
}
$payload = $parts[0];
$sig = $parts[1];
$expected = hash_hmac("sha256", $payload, $secret);
if (!hash_equals($expected, $sig)) {
  fail(403, "Neplatný token.");
}

$json = json_decode(b64url_decode($payload), true);
if (!is_array($json)) {
  fail(403, "Neplatný token.");
}
$exp = (int) ($json["exp"] ?? 0);
if ($exp < time()) {
  fail(403, "Token vypršal. Skús nahratie znova.");
}
$kind = (string) ($json["kind"] ?? "");
$max = (int) ($json["max"] ?? 0);
if ($kind !== "audio" && $kind !== "video") {
  fail(400, "Neplatný typ súboru.");
}
if ($max < 1) {
  fail(400, "Neplatný limit veľkosti.");
}

if (!isset($_FILES["file"]) || !is_array($_FILES["file"])) {
  fail(400, "Chýba súbor.");
}
$file = $_FILES["file"];
if ((int) ($file["error"] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
  fail(400, "Súbor sa nepodarilo prijať.");
}
$size = (int) ($file["size"] ?? 0);
if ($size < 1 || $size > $max) {
  fail(400, "Súbor je príliš veľký.");
}

$ext = strtolower(pathinfo((string) ($file["name"] ?? ""), PATHINFO_EXTENSION));
$allowedExt = $kind === "audio"
  ? ["mp3", "m4a", "wav", "ogg", "aac"]
  : ["mp4", "webm", "mov", "m4v"];
if (!in_array($ext, $allowedExt, true)) {
  fail(400, "Nepodporovaný typ súboru.");
}

$dir = __DIR__ . "/" . $kind;
if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
  fail(500, "Priečinok sa nedá vytvoriť.");
}

try {
  $stored = bin2hex(random_bytes(16)) . "." . $ext;
} catch (Throwable $error) {
  fail(500, "Súbor sa nepodarilo pomenovať.");
}

$dest = $dir . "/" . $stored;
if (!move_uploaded_file((string) $file["tmp_name"], $dest)) {
  fail(500, "Súbor sa nepodarilo uložiť.");
}

header("Content-Type: application/json; charset=utf-8");
echo json_encode(
  ["url" => rtrim($publicBase, "/") . "/" . $kind . "/" . $stored],
  JSON_UNESCAPED_UNICODE
);
