<?php
declare(strict_types=1);

// ── Konfiguration ─────────────────────────────────────────────────────────────
define('RESEND_API_KEY', getenv('RESEND_API_KEY') ?: 'YOUR_RESEND_API_KEY');
define('FROM_EMAIL',     'AGRI-Office Website <noreply@agri-office.de>');
define('TO_EMAIL',       'info@agri-office.de');
define('RATE_LIMIT',     3);   // max. Anfragen pro Stunde pro IP
define('RATE_WINDOW',    3600);

// ── Nur POST erlauben ─────────────────────────────────────────────────────────
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Methode nicht erlaubt']);
    exit;
}

// ── CSRF-Token prüfen ─────────────────────────────────────────────────────────
session_start();
$token = trim($_POST['csrf'] ?? '');
if (!isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
    // Frischen Token mitgeben, damit ein abgelaufener Token (z.B. lange offenes
    // Tab) kein Neuladen erzwingt — der Client setzt ihn und der zweite Versuch
    // geht durch. Unbedenklich: Ein fremder Ursprung kann diese Antwort wegen
    // CORS nicht lesen, und /csrf.php gibt Tokens ohnehin frei heraus.
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    http_response_code(403);
    echo json_encode([
        'ok'    => false,
        'error' => 'Sitzung abgelaufen. Bitte senden Sie die Anfrage noch einmal ab.',
        'csrf'  => $_SESSION['csrf_token'],
    ]);
    exit;
}
// Token NICHT hier verbrauchen: Jeder vorzeitige Abbruch (Validierungsfehler,
// Rate-Limit, Resend-Ausfall) würde das Formular sonst dauerhaft lahmlegen — der
// Client behält seinen inzwischen ungültigen Token und bekommt ab dann nur noch
// "Ungültige Sitzung". Der Token wird erst nach erfolgreichem Versand rotiert
// (siehe unten), und jede Fehlerantwort liefert ihn über antwortMitToken() mit.

/**
 * Beendet die Anfrage mit einem Fehler und gibt den weiterhin gültigen CSRF-Token
 * zurück, damit der Besucher es direkt noch einmal versuchen kann.
 */
function antwortMitToken(int $status, string $error): void {
    http_response_code($status);
    echo json_encode([
        'ok'    => false,
        'error' => $error,
        'csrf'  => $_SESSION['csrf_token'] ?? '',
    ]);
    exit;
}

// ── Rate-Limiting (session-basiert) ───────────────────────────────────────────
$ip  = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$key = 'rl_' . md5($ip);
if (!isset($_SESSION[$key])) {
    $_SESSION[$key] = ['count' => 0, 'first' => time()];
}
$rl = &$_SESSION[$key];
if (time() - $rl['first'] > RATE_WINDOW) {
    $rl = ['count' => 0, 'first' => time()];
}
// Nur prüfen, noch nicht hochzählen: ein Tippfehler im E-Mail-Feld darf kein
// Kontingent verbrauchen. Gezählt wird erst, wenn tatsächlich eine Mail rausgeht.
if ($rl['count'] >= RATE_LIMIT) {
    antwortMitToken(429, 'Zu viele Anfragen. Bitte warten Sie eine Stunde.');
}

// ── Honeypot (Bot-Schutz) ─────────────────────────────────────────────────────
if (!empty($_POST['website'])) {
    // Stille Ablehnung – für Bots sieht es wie Erfolg aus
    echo json_encode(['ok' => true]);
    exit;
}

// ── Eingaben bereinigen & validieren ──────────────────────────────────────────
function clean(string $s, int $max = 200): string {
    return mb_substr(strip_tags(trim($s)), 0, $max);
}

$name      = clean($_POST['name']      ?? '');
$firma     = clean($_POST['firma']     ?? '');
$email     = clean($_POST['email']     ?? '', 254);
$telefon   = clean($_POST['telefon']   ?? '', 30);
$paket     = clean($_POST['paket']     ?? '');
// Produktlinie (index.html sendet nichts, eierhandel.html sendet "Eierhandel") und
// Betriebsart — beides optional, damit das Formular beider Landingpages dieselbe
// Route nutzen kann, ohne dass eines der Felder Pflicht wird.
// Gegen eine Whitelist prüfen: Das Feld steuert Betreff und Resend-Tag `linie`
// und damit die Auswertung nach Produktlinie — ein frei gesetzter Wert aus einem
// Skript-Post würde die Statistik verfälschen.
$QUELLEN     = ['Eierhandel', 'Agrarhandel'];
$quelle_roh  = clean($_POST['quelle'] ?? '', 40);
$quelle      = in_array($quelle_roh, $QUELLEN, true) ? $quelle_roh : '';
$betriebsart = clean($_POST['betriebsart'] ?? '', 60);
$nachricht = clean($_POST['nachricht'] ?? '', 2000);
$dsgvo     = !empty($_POST['dsgvo']);

$errors = [];
if (strlen($name) < 2)                           $errors[] = 'Bitte geben Sie Ihren Namen ein.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL))  $errors[] = 'Bitte eine gültige E-Mail-Adresse eingeben.';
if (strlen($nachricht) < 10)                     $errors[] = 'Bitte schreiben Sie eine kurze Nachricht (min. 10 Zeichen).';
if (!$dsgvo)                                     $errors[] = 'Bitte stimmen Sie der Datenschutzerklärung zu.';

if ($errors) {
    antwortMitToken(422, implode(' ', $errors));
}

// ── E-Mail-Text aufbauen ──────────────────────────────────────────────────────
$paket_label = $paket ?: '(nicht angegeben)';
$telefon_label = $telefon ?: '(nicht angegeben)';
$quelle_label = $quelle ?: 'Agrarhandel';
// Zeile nur einblenden, wenn die Betriebsart tatsächlich gewählt wurde — die
// Agrarhandel-Seite kennt das Feld gar nicht.
$betriebsart_block = $betriebsart
    ? '<div class="field"><div class="field-label">Betriebsart</div><div class="field-value">' . $betriebsart . '</div></div>'
    : '';

$html = <<<HTML
<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1f2937;background:#f9fafb;margin:0;padding:0}
.wrap{max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:#1b4332;padding:28px 32px;color:white}
.header h1{margin:0;font-size:1.3rem;font-weight:700}
.header p{margin:6px 0 0;font-size:.875rem;opacity:.75}
.body{padding:32px}
.field{margin-bottom:20px}
.field-label{font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#6b7280;margin-bottom:4px}
.field-value{font-size:1rem;color:#111827;background:#f3f4f6;padding:10px 14px;border-radius:8px;border-left:3px solid #40916c}
.msg{white-space:pre-line}
.footer{background:#f3f4f6;padding:20px 32px;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head>
<body><div class="wrap">
<div class="header">
  <h1>Neue Anfrage über AGRI-Office.de</h1>
  <p>Eingegangen: {$_SERVER['REQUEST_TIME']} · IP: {$ip}</p>
</div>
<div class="body">
  <div class="field"><div class="field-label">Name</div><div class="field-value">$name</div></div>
  <div class="field"><div class="field-label">Firma / Betrieb</div><div class="field-value">$firma</div></div>
  <div class="field"><div class="field-label">E-Mail</div><div class="field-value"><a href="mailto:$email">$email</a></div></div>
  <div class="field"><div class="field-label">Telefon</div><div class="field-value">$telefon_label</div></div>
  <div class="field"><div class="field-label">Produktlinie</div><div class="field-value">$quelle_label</div></div>
  $betriebsart_block
  <div class="field"><div class="field-label">Gewünschter Plan</div><div class="field-value">$paket_label</div></div>
  <div class="field"><div class="field-label">Nachricht</div><div class="field-value msg">$nachricht</div></div>
</div>
<div class="footer">Diese E-Mail wurde automatisch von der AGRI-Office-Website gesendet. DSGVO-Einwilligung: erteilt.</div>
</div></body></html>
HTML;

// ── Resend API aufrufen ───────────────────────────────────────────────────────
$payload = json_encode([
    'from'    => FROM_EMAIL,
    'to'      => [TO_EMAIL],
    'reply_to'=> $email,
    'subject' => "Neue AGRI-Office-Anfrage ($quelle_label) von $name ($firma)",
    'html'    => $html,
    'tags'    => [
        ['name' => 'source',  'value' => 'website-contact'],
        ['name' => 'linie',   'value' => preg_replace('/[^a-z0-9_\-]/i', '', $quelle_label) ?: 'unknown'],
        ['name' => 'paket',   'value' => preg_replace('/[^a-z0-9_\-]/i', '', $paket) ?: 'unknown'],
    ],
]);

$ch = curl_init('https://api.resend.com/emails');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . RESEND_API_KEY,
        'Content-Type: application/json',
        'Content-Length: ' . strlen($payload),
    ],
    CURLOPT_POSTFIELDS     => $payload,
]);

$body   = curl_exec($ch);
$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err    = curl_error($ch);
curl_close($ch);

if ($err || $status < 200 || $status >= 300) {
    error_log("Resend API Fehler: status=$status err=$err body=$body");
    antwortMitToken(502, 'E-Mail konnte nicht gesendet werden. Bitte versuchen Sie es erneut oder rufen Sie uns direkt an.');
}

// Ab hier ist die Mail raus — erst jetzt zählt die Anfrage aufs Stundenkontingent.
$rl['count']++;

// ── Bestätigungs-E-Mail an Interessenten ──────────────────────────────────────
$confirm_html = <<<HTML
<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><style>
body{font-family:Arial,sans-serif;color:#1f2937;background:#f9fafb;margin:0}
.wrap{max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)}
.header{background:#1b4332;padding:32px;color:white;text-align:center}
.header h1{margin:0;font-size:1.4rem}
.header p{margin:8px 0 0;opacity:.8}
.body{padding:32px;text-align:center}
.body p{color:#4b5563;line-height:1.7;margin-bottom:16px}
.highlight{background:#d8f3dc;border-radius:8px;padding:16px;margin:24px 0;font-weight:600;color:#1b4332}
.footer{padding:20px 32px;text-align:center;font-size:.8rem;color:#9ca3af;border-top:1px solid #e5e7eb}
</style></head>
<body><div class="wrap">
<div class="header">
  <h1>Danke, $name!</h1>
  <p>Ihre Anfrage ist bei uns angekommen.</p>
</div>
<div class="body">
  <p>Wir haben Ihre Anfrage erhalten und melden uns innerhalb von <strong>1 Werktag</strong> bei Ihnen zurück.</p>
  <div class="highlight">📞 Telefon: +49 (0) 000 000000<br>✉ E-Mail: info@agri-office.de</div>
  <p>Bis dahin können Sie unsere <a href="https://agri-office.de/#funktionen" style="color:#40916c">Funktionsübersicht</a> erkunden oder direkt mit dem <strong>14-tägigen kostenlosen Test</strong> starten.</p>
</div>
<div class="footer">AGRI-Office · info@agri-office.de · agri-office.de</div>
</div></body></html>
HTML;

$confirm_payload = json_encode([
    'from'    => FROM_EMAIL,
    'to'      => [$email],
    'subject' => 'Ihre AGRI-Office-Anfrage ist eingegangen',
    'html'    => $confirm_html,
]);

$ch2 = curl_init('https://api.resend.com/emails');
curl_setopt_array($ch2, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_TIMEOUT        => 8,
    CURLOPT_HTTPHEADER     => [
        'Authorization: Bearer ' . RESEND_API_KEY,
        'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS => $confirm_payload,
]);
curl_exec($ch2);
curl_close($ch2);

// ── CSRF-Token für nächste Anfrage neu generieren ─────────────────────────────
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

echo json_encode([
    'ok'      => true,
    'message' => 'Danke! Ihre Nachricht wurde gesendet. Wir melden uns innerhalb von 1 Werktag.',
    'csrf'    => $_SESSION['csrf_token'],
]);
