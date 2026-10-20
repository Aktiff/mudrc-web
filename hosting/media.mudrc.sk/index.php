<?php
declare(strict_types=1);

$configPath = __DIR__ . "/media-config.php";
$config = is_file($configPath) ? require $configPath : null;
$password = is_array($config) && isset($config["password"]) && $config["password"] !== ""
  ? (string) $config["password"]
  : "mudrc2026";
$publicBase = is_array($config) ? rtrim((string) ($config["public_base"] ?? "https://media.mudrc.sk"), "/") : "https://media.mudrc.sk";

function cookieOptions(int $expires): array {
  return [
    "expires" => $expires,
    "path" => "/",
    "secure" => true,
    "httponly" => true,
    "samesite" => "Lax",
  ];
}

if (isset($_GET["logout"])) {
  setcookie("admin_session", "", cookieOptions(time() - 3600));
  header("Location: /");
  exit;
}

$error = "";
if (($_SERVER["REQUEST_METHOD"] ?? "") === "POST") {
  $given = (string) ($_POST["password"] ?? "");
  if (hash_equals($password, $given)) {
    setcookie("admin_session", $password, cookieOptions(time() + 60 * 60 * 24 * 7));
    header("Location: /");
    exit;
  }
  $error = "Nesprávne heslo";
}

$loggedIn = isset($_COOKIE["admin_session"]) && hash_equals($password, (string) $_COOKIE["admin_session"]);

function formatBytes(int $bytes): string {
  if ($bytes < 1024) {
    return $bytes . " B";
  }
  if ($bytes < 1024 * 1024) {
    return number_format($bytes / 1024, 1, ",", " ") . " KB";
  }
  return number_format($bytes / (1024 * 1024), 1, ",", " ") . " MB";
}

function listFolder(string $dir, string $kind, array $extensions): array {
  if (!is_dir($dir)) {
    return [];
  }
  $rows = [];
  $names = scandir($dir);
  if ($names === false) {
    return [];
  }
  foreach ($names as $name) {
    if ($name === "." || $name === "..") {
      continue;
    }
    $path = $dir . "/" . $name;
    if (!is_file($path)) {
      continue;
    }
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, $extensions, true)) {
      continue;
    }
    $rows[] = [
      "name" => $name,
      "kind" => $kind,
      "size" => (int) filesize($path),
      "time" => (int) filemtime($path),
    ];
  }
  usort($rows, function (array $a, array $b): int {
    return $b["time"] <=> $a["time"];
  });
  return $rows;
}

$items = [];
if ($loggedIn) {
  $items = array_merge(
    listFolder(__DIR__ . "/audio", "zvuk", ["mp3", "m4a", "wav", "ogg", "aac"]),
    listFolder(__DIR__ . "/video", "video", ["mp4", "webm", "mov", "m4v"])
  );
  usort($items, function (array $a, array $b): int {
    return $b["time"] <=> $a["time"];
  });
}
$totalBytes = 0;
foreach ($items as $item) {
  $totalBytes += $item["size"];
}

header("Content-Type: text/html; charset=utf-8");
header("X-Robots-Tag: noindex");
header("Cache-Control: no-store");
?>
<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title><?php echo $loggedIn ? "Ukážky" : "Mudrc admin"; ?></title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: #141414; color: #f4f4f4; font-family: system-ui, sans-serif; }
    a { color: #f0c800; }
    .wrap { max-width: 920px; margin: 0 auto; padding: 32px 16px 64px; }
    .card { background: #1e1e1e; border: 1px solid #333; border-radius: 16px; padding: 28px 24px; }
    .login { max-width: 380px; margin: 12vh auto; text-align: center; }
    h1 { font-size: 28px; letter-spacing: 0.04em; margin: 0 0 6px; }
    p.muted { color: #9a9a9a; margin: 0 0 22px; font-size: 14px; }
    input[type="password"] { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #444; background: #111; color: #fff; font-size: 16px; }
    button, .btn { display: inline-block; background: #f0c800; color: #1a1a1a; border: 0; border-radius: 10px; padding: 12px 16px; font-weight: 700; text-decoration: none; cursor: pointer; }
    .error { color: #ff6b6b; font-size: 14px; margin: 10px 0 0; }
    .top { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #2c2c2c; vertical-align: middle; }
    th { color: #9a9a9a; font-size: 12px; font-weight: 600; }
    .kind { color: #9a9a9a; }
    audio, video { width: 180px; height: 32px; }
    video { height: 72px; }
  </style>
</head>
<body>
<?php if (!$loggedIn) { ?>
  <div class="card login">
    <h1>MUDRC ADMIN</h1>
    <p class="muted">Zadaj heslo pre vstup</p>
    <form method="post" action="/">
      <input type="password" name="password" placeholder="Heslo" autofocus>
      <?php if ($error !== "") { ?><p class="error"><?php echo htmlspecialchars($error, ENT_QUOTES, "UTF-8"); ?></p><?php } ?>
      <p style="margin-top:16px"><button type="submit">Vstup</button></p>
    </form>
  </div>
<?php } else { ?>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>Ukážky</h1>
        <p class="muted"><?php echo count($items); ?> súborov · <?php echo formatBytes($totalBytes); ?></p>
      </div>
      <a class="btn" href="/?logout=1">Odhlásiť</a>
    </div>
    <?php if (!$items) { ?>
      <div class="card"><p class="muted">Zatiaľ tu nie sú žiadne ukážky.</p></div>
    <?php } else { ?>
      <div class="card" style="overflow-x:auto">
        <table>
          <thead>
            <tr>
              <th>Súbor</th>
              <th>Typ</th>
              <th>Veľkosť</th>
              <th>Dátum</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
          <?php foreach ($items as $item) {
            $url = $publicBase . "/" . ($item["kind"] === "video" ? "video" : "audio") . "/" . rawurlencode($item["name"]);
            ?>
            <tr>
              <td><?php echo htmlspecialchars($item["name"], ENT_QUOTES, "UTF-8"); ?></td>
              <td class="kind"><?php echo $item["kind"] === "video" ? "video" : "zvuk"; ?></td>
              <td><?php echo formatBytes($item["size"]); ?></td>
              <td><?php echo date("j.n.Y H:i", $item["time"]); ?></td>
              <td>
                <?php if ($item["kind"] === "video") { ?>
                  <video controls preload="none" src="<?php echo htmlspecialchars($url, ENT_QUOTES, "UTF-8"); ?>"></video>
                <?php } else { ?>
                  <audio controls preload="none" src="<?php echo htmlspecialchars($url, ENT_QUOTES, "UTF-8"); ?>"></audio>
                <?php } ?>
              </td>
            </tr>
          <?php } ?>
          </tbody>
        </table>
      </div>
    <?php } ?>
  </div>
<?php } ?>
</body>
</html>
