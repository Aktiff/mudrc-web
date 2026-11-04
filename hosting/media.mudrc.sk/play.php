<?php
declare(strict_types=1);

/**
 * Prehrávanie súboru z tohto hostingu s CORS.
 * Prehliadač inak nedovolí video a hudbu zosilniť nad 100 %.
 * Súbor sa nekopíruje, len sa pošle s hlavičkami. Rozsah (Range) ostáva, aby šlo previnúť.
 */

$origin = isset($_SERVER["HTTP_ORIGIN"]) ? (string) $_SERVER["HTTP_ORIGIN"] : "";
$allowedOrigins = [
  "https://www.mudrc.sk",
  "https://mudrc.sk",
  "http://localhost:3000",
];
if (in_array($origin, $allowedOrigins, true)) {
  header("Access-Control-Allow-Origin: " . $origin);
} else {
  header("Access-Control-Allow-Origin: https://www.mudrc.sk");
}
header("Vary: Origin");
header("Access-Control-Allow-Methods: GET, HEAD, OPTIONS");
header("Access-Control-Allow-Headers: Range");
header("Access-Control-Expose-Headers: Accept-Ranges, Content-Length, Content-Range, Content-Type");
header("Access-Control-Max-Age: 86400");

$method = (string) ($_SERVER["REQUEST_METHOD"] ?? "GET");
if ($method === "OPTIONS") {
  http_response_code(204);
  exit;
}

if (isset($_GET["probe"])) {
  http_response_code(204);
  exit;
}

$path = isset($_GET["f"]) ? (string) $_GET["f"] : "";
$path = str_replace("\\", "/", $path);
if ($path === "" || strpos($path, "..") !== false || strpos($path, "\0") !== false || !preg_match("#^(audio|video)/[^/]+$#", $path)) {
  http_response_code(400);
  exit;
}

$file = __DIR__ . "/" . $path;
if (!is_file($file)) {
  http_response_code(404);
  exit;
}

$ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
$types = [
  "mp3" => "audio/mpeg",
  "m4a" => "audio/mp4",
  "wav" => "audio/wav",
  "ogg" => "audio/ogg",
  "aac" => "audio/aac",
  "mp4" => "video/mp4",
  "webm" => "video/webm",
  "mov" => "video/quicktime",
  "m4v" => "video/mp4",
];
$type = $types[$ext] ?? "application/octet-stream";
$size = filesize($file);
if ($size === false || $size < 1) {
  http_response_code(404);
  exit;
}

while (ob_get_level() > 0) {
  ob_end_clean();
}

header("Content-Type: " . $type);
header("Accept-Ranges: bytes");
header("Cache-Control: public, max-age=86400");
header("X-Content-Type-Options: nosniff");

$start = 0;
$end = $size - 1;
$range = isset($_SERVER["HTTP_RANGE"]) ? (string) $_SERVER["HTTP_RANGE"] : "";
if ($range !== "" && preg_match("/bytes=(\d*)-(\d*)/", $range, $match)) {
  if ($match[1] === "" && $match[2] !== "") {
    $start = max(0, $size - (int) $match[2]);
  } else {
    $start = (int) $match[1];
    if ($match[2] !== "") {
      $end = (int) $match[2];
    }
  }
  if ($start > $end || $start >= $size) {
    http_response_code(416);
    header("Content-Range: bytes */" . $size);
    exit;
  }
  $end = min($end, $size - 1);
  http_response_code(206);
  header("Content-Range: bytes " . $start . "-" . $end . "/" . $size);
  header("Content-Length: " . ($end - $start + 1));
} else {
  header("Content-Length: " . $size);
}

if ($method === "HEAD") {
  exit;
}

$handle = fopen($file, "rb");
if ($handle === false) {
  http_response_code(404);
  exit;
}
fseek($handle, $start);
$left = $end - $start + 1;
while ($left > 0 && !feof($handle)) {
  $chunk = fread($handle, (int) min(65536, $left));
  if ($chunk === false || $chunk === "") {
    break;
  }
  echo $chunk;
  $left -= strlen($chunk);
  if (connection_aborted()) {
    break;
  }
}
fclose($handle);
