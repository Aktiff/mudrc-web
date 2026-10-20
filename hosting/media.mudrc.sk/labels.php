<?php
declare(strict_types=1);

if (realpath((string) ($_SERVER["SCRIPT_FILENAME"] ?? "")) === __FILE__) {
  http_response_code(404);
  exit;
}

function mediaLabelsPath(): string {
  return __DIR__ . "/labels.data.php";
}

function loadMediaLabels(): array {
  $path = mediaLabelsPath();
  if (!is_file($path)) {
    return [];
  }
  $data = require $path;
  return is_array($data) ? $data : [];
}

function saveMediaLabels(array $labels): void {
  $path = mediaLabelsPath();
  $body = "<?php\n";
  $body .= "if (realpath((string) (\$_SERVER[\"SCRIPT_FILENAME\"] ?? \"\")) === __FILE__) { http_response_code(404); exit; }\n";
  $body .= "return " . var_export($labels, true) . ";\n";
  $tmp = $path . ".tmp";
  file_put_contents($tmp, $body, LOCK_EX);
  rename($tmp, $path);
}

function cleanOriginalName(string $name): string {
  $base = basename(str_replace("\\", "/", $name));
  $base = str_replace(["\r", "\n", "\0"], "", $base);
  $base = trim($base);
  if ($base === "" || $base === "." || $base === "..") {
    return "";
  }
  if (strlen($base) > 180) {
    $base = substr($base, 0, 180);
  }
  return $base;
}

function rememberMediaLabel(string $key, string $name): void {
  $clean = cleanOriginalName($name);
  if ($key === "" || $clean === "") {
    return;
  }
  $lockPath = __DIR__ . "/labels.lock";
  $lock = fopen($lockPath, "c");
  if ($lock === false) {
    return;
  }
  flock($lock, LOCK_EX);
  $labels = loadMediaLabels();
  $labels[$key] = $clean;
  saveMediaLabels($labels);
  flock($lock, LOCK_UN);
  fclose($lock);
}

function fetchMudrcLabels(string $secret): array {
  if ($secret === "" || strpos($secret, "SEM_DAJ") === 0) {
    return [];
  }
  $json = json_encode(["exp" => time() + 60, "purpose" => "labels"]);
  if ($json === false) {
    return [];
  }
  $payload = rtrim(strtr(base64_encode($json), "+/", "-_"), "=");
  $token = $payload . "." . hash_hmac("sha256", $payload, $secret);
  $url = "https://www.mudrc.sk/api/media-labels";
  $raw = false;
  if (function_exists("curl_init")) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $token);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: text/plain", "Accept: application/json"]);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
    $raw = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_string($raw)) {
      return [];
    }
  } else {
    $context = stream_context_create([
      "http" => [
        "method" => "POST",
        "header" => "Content-Type: text/plain\r\nAccept: application/json\r\n",
        "content" => $token,
        "timeout" => 25,
        "ignore_errors" => true,
      ],
    ]);
    $raw = @file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? "";
    if (!is_string($raw) || strpos($statusLine, " 200 ") === false) {
      return [];
    }
  }

  $data = json_decode($raw, true);
  if (!is_array($data) || !isset($data["names"]) || !is_array($data["names"])) {
    return [];
  }
  $out = [];
  foreach ($data["names"] as $key => $value) {
    if (!is_string($key) || !is_string($value)) {
      continue;
    }
    $clean = trim(str_replace(["\r", "\n", "\0"], "", $value));
    if ($clean !== "") {
      $out[$key] = $clean;
    }
  }
  return $out;
}
