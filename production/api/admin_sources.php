<?php
/**
 * LASU Campus Broadcast - Multi-Source Live Headlines & RSS/Atom Wire API
 */
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    json_response(['error' => 'Method not allowed.'], 405);
}

require_admin_api();

$PRESET_SOURCES = [
    ['key' => 'lasu', 'name' => 'LASU Official Newsroom', 'url' => 'https://lasu.edu.ng/home/news/read.php?id=569', 'category' => 'University'],
    ['key' => 'punch', 'name' => 'Punch Nigeria', 'url' => 'https://punchng.com/feed/', 'category' => 'National'],
    ['key' => 'vanguard', 'name' => 'Vanguard Nigeria', 'url' => 'https://www.vanguardngr.com/feed/', 'category' => 'National'],
    ['key' => 'channels', 'name' => 'Channels TV', 'url' => 'https://www.channelstv.com/feed/', 'category' => 'Broadcast'],
    ['key' => 'premiumtimes', 'name' => 'Premium Times', 'url' => 'https://www.premiumtimesng.com/feed', 'category' => 'National'],
    ['key' => 'dailypost', 'name' => 'Daily Post Nigeria', 'url' => 'https://dailypost.ng/feed/', 'category' => 'National'],
    ['key' => 'bbcafrica', 'name' => 'BBC Africa', 'url' => 'https://feeds.bbci.co.uk/news/world/africa/rss.xml', 'category' => 'International'],
];

function is_safe_external_url(string $url): bool
{
    $parts = parse_url($url);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        return false;
    }
    $scheme = strtolower((string) $parts['scheme']);
    if ($scheme !== 'http' && $scheme !== 'https') {
        return false;
    }
    $host = strtolower((string) $parts['host']);
    if ($host === 'localhost' || str_ends_with($host, '.local') || str_ends_with($host, '.internal')) {
        return false;
    }
    if (filter_var($host, FILTER_VALIDATE_IP)) {
        return filter_var($host, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) !== false;
    }
    $ips = @gethostbynamel($host);
    if (is_array($ips)) {
        foreach ($ips as $ip) {
            if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false) {
                return false;
            }
        }
    }
    return true;
}

function http_get_external(string $url, array $extraHeaders = [], int $timeout = 6): array
{
    $headers = array_merge([
        'User-Agent: Mozilla/5.0 (compatible; LASU-Campus-Broadcast/1.0)',
        'Accept: application/rss+xml, application/atom+xml, application/xml, text/xml, text/html, application/json;q=0.9',
    ], $extraHeaders);

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS      => 3,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => 4,
            CURLOPT_HTTPHEADER     => $headers,
            CURLOPT_HEADER         => true,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $raw = curl_exec($ch);
        $err = curl_error($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $headerSize = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        curl_close($ch);

        if ($raw === false || $code >= 400 || $code === 0) {
            return ['ok' => false, 'status' => $code, 'body' => '', 'headers' => '', 'error' => $err ?: ('HTTP ' . $code)];
        }
        return [
            'ok'      => true,
            'status'  => $code,
            'headers' => substr($raw, 0, $headerSize),
            'body'    => substr($raw, $headerSize),
            'error'   => '',
        ];
    }

    $ctx = stream_context_create([
        'http' => [
            'method'  => 'GET',
            'timeout' => $timeout,
            'header'  => implode("\r\n", $headers) . "\r\n",
        ],
    ]);
    $body = @file_get_contents($url, false, $ctx);
    if ($body === false) {
        return ['ok' => false, 'status' => 0, 'body' => '', 'headers' => '', 'error' => 'Failed to fetch URL'];
    }
    return ['ok' => true, 'status' => 200, 'body' => $body, 'headers' => '', 'error' => ''];
}

function clean_wire_text(string $html): string
{
    $text = html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    $text = strip_tags($text);
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;
    return trim($text);
}

function suggest_category_slug(string $title, string $summary): string
{
    $hay = strtolower($title . ' ' . $summary);
    if (preg_match('/sport|football|olympic|athletic|championship|match|league|medal/', $hay)) {
        return 'sports';
    }
    if (preg_match('/exam|matric|convocation|academic|faculty|senate|lecture|vc|vice-chancellor|research|professor|scholarship/', $hay)) {
        return 'academic-updates';
    }
    if (preg_match('/student|sug|hostel|campus|youth|nysc|fellowship/', $hay)) {
        return 'student-news';
    }
    if (preg_match('/notice|circular|deadline|memo|alert|registration|admission|portal/', $hay)) {
        return 'announcements';
    }
    if (preg_match('/summit|conference|festival|workshop|seminar|fair|day/', $hay)) {
        return 'events';
    }
    return 'university-news';
}

function parse_rss_or_atom(string $xmlString, string $sourceKey, string $sourceName): array
{
    libxml_use_internal_errors(true);
    $xml = @simplexml_load_string($xmlString, 'SimpleXMLElement', LIBXML_NOCDATA);
    if (!$xml) {
        libxml_clear_errors();
        return [];
    }

    $items = [];
    if (isset($xml->channel->item)) {
        $nodes = $xml->channel->item;
    } elseif (isset($xml->entry)) {
        $nodes = $xml->entry;
    } else {
        $nodes = [];
    }

    foreach ($nodes as $node) {
        if (count($items) >= 12) {
            break;
        }
        $title = clean_wire_text((string) ($node->title ?? ''));
        if ($title === '') {
            continue;
        }

        $link = trim((string) ($node->link ?? ''));
        if ($link === '' && isset($node->link['href'])) {
            $link = trim((string) $node->link['href']);
        }

        $descRaw = (string) ($node->description ?? $node->summary ?? '');
        $nsContent = $node->children('http://purl.org/rss/1.0/modules/content/');
        $encodedRaw = (string) ($nsContent->encoded ?? $node->content ?? '');

        $summary = clean_wire_text($descRaw !== '' ? $descRaw : $encodedRaw);
        if (mb_strlen($summary) > 360) {
            $summary = mb_substr($summary, 0, 357) . '...';
        }
        $content = clean_wire_text($encodedRaw !== '' ? $encodedRaw : $descRaw);
        if ($content === '') {
            $content = $summary !== '' ? $summary : ($title . ' — Dispatched via ' . $sourceName);
        }

        $imageUrl = '';
        $nsMedia = $node->children('http://search.yahoo.com/mrss/');
        if (isset($nsMedia->content['url'])) {
            $imageUrl = (string) $nsMedia->content['url'];
        } elseif (isset($nsMedia->thumbnail['url'])) {
            $imageUrl = (string) $nsMedia->thumbnail['url'];
        } elseif (isset($node->enclosure['url'])) {
            $imageUrl = (string) $node->enclosure['url'];
        } elseif (preg_match('/<img[^>]+src=["\']([^"\']+)["\']/i', $encodedRaw . ' ' . $descRaw, $m)) {
            $imageUrl = $m[1];
        }

        $pubRaw = (string) ($node->pubDate ?? $node->published ?? $node->updated ?? '');
        $ts = $pubRaw !== '' ? strtotime($pubRaw) : false;
        $publishedAt = $ts !== false ? gmdate('Y-m-d H:i:s', $ts) : gmdate('Y-m-d H:i:s');

        $items[] = [
            'id'                      => $sourceKey . '_' . substr(md5($link ?: $title), 0, 12),
            'source_key'              => $sourceKey,
            'source_name'             => $sourceName,
            'title'                   => $title,
            'summary'                 => $summary,
            'content'                 => $content,
            'url'                     => $link,
            'image_url'               => $imageUrl,
            'published_at'            => $publishedAt,
            'suggested_category_slug' => suggest_category_slug($title, $summary),
        ];
    }

    libxml_clear_errors();
    return $items;
}

function fetch_lasu_newsroom_items(): array
{
    $ids = [569, 620, 619, 618, 617, 616, 615, 614];
    $seedResp = http_get_external('https://lasu.edu.ng/home/news/read.php?id=569', [], 6);
    if (!$seedResp['ok']) {
        throw new RuntimeException($seedResp['error'] ?: 'LASU newsroom unreachable');
    }

    $cookieHeader = '';
    if (preg_match('/Set-Cookie:\s*(PHPSESSID=[^;\r\n]+)/i', $seedResp['headers'], $m)) {
        $cookieHeader = 'Cookie: ' . $m[1];
    }

    $items = [];
    foreach ($ids as $id) {
        $url = 'https://lasu.edu.ng/home/news/read.php?id=' . $id;
        $extra = $cookieHeader !== '' ? [$cookieHeader] : [];
        $page = $id === 569 ? $seedResp : http_get_external($url, $extra, 5);
        if (!$page['ok']) {
            continue;
        }
        $html = $page['body'];
        $title = '';
        if (preg_match('/<h[1-3][^>]*>(.*?)<\/h[1-3]>/is', $html, $tm)) {
            $title = clean_wire_text($tm[1]);
        } elseif (preg_match('/<title[^>]*>(.*?)<\/title>/is', $html, $tm)) {
            $title = clean_wire_text($tm[1]);
        }
        if ($title === '' || strlen($title) < 8) {
            continue;
        }
        $bodyText = '';
        if (preg_match('/<article[^>]*>(.*?)<\/article>/is', $html, $bm) || preg_match('/class=["\'][^"\']*news[^"\']*["\'][^>]*>(.*?)<\/div>/is', $html, $bm)) {
            $bodyText = clean_wire_text($bm[1]);
        }
        if ($bodyText === '') {
            $bodyText = $title . ' — Official news dispatch published on Lagos State University Portal.';
        }
        $summary = mb_strlen($bodyText) > 280 ? mb_substr($bodyText, 0, 277) . '...' : $bodyText;
        $imgUrl = '';
        if (preg_match('/<img[^>]+src=["\']([^"\']*(?:news|upload|banner)[^"\']*)["\']/i', $html, $im)) {
            $src = $im[1];
            $imgUrl = str_starts_with($src, 'http') ? $src : ('https://lasu.edu.ng/' . ltrim($src, '/'));
        }

        $items[] = [
            'id'                      => 'lasu_' . $id,
            'source_key'              => 'lasu',
            'source_name'             => 'LASU Official Newsroom',
            'title'                   => $title,
            'summary'                 => $summary,
            'content'                 => $bodyText,
            'url'                     => $url,
            'image_url'               => $imgUrl,
            'published_at'            => gmdate('Y-m-d H:i:s'),
            'suggested_category_slug' => suggest_category_slug($title, $summary),
        ];
    }

    return $items;
}

$sourceKey = trim((string) ($_GET['source'] ?? 'all'));
$query = strtolower(trim((string) ($_GET['q'] ?? '')));
$customUrl = trim((string) ($_GET['custom_url'] ?? ''));

$allItems = [];
$statuses = [];

if ($customUrl !== '') {
    if (!is_safe_external_url($customUrl)) {
        json_response(['error' => 'Please enter a valid public http(s) RSS or Atom feed URL.'], 400);
    }
    $host = (string) parse_url($customUrl, PHP_URL_HOST);
    $resp = http_get_external($customUrl, [], 7);
    if (!$resp['ok']) {
        $statuses[] = ['key' => 'custom', 'name' => $host, 'ok' => false, 'count' => 0, 'error' => $resp['error']];
    } else {
        $parsed = parse_rss_or_atom($resp['body'], 'custom', $host);
        $statuses[] = ['key' => 'custom', 'name' => $host, 'ok' => count($parsed) > 0, 'count' => count($parsed)];
        $allItems = array_merge($allItems, $parsed);
    }
} else {
    $targets = ($sourceKey !== '' && $sourceKey !== 'all')
        ? array_values(array_filter($PRESET_SOURCES, static fn (array $s): bool => $s['key'] === $sourceKey))
        : $PRESET_SOURCES;

    if (empty($targets)) {
        $targets = $PRESET_SOURCES;
    }

    foreach ($targets as $src) {
        if ($src['key'] === 'lasu') {
            try {
                $lasuItems = fetch_lasu_newsroom_items();
                $statuses[] = ['key' => 'lasu', 'name' => $src['name'], 'ok' => count($lasuItems) > 0, 'count' => count($lasuItems)];
                $allItems = array_merge($allItems, $lasuItems);
            } catch (Throwable $e) {
                $statuses[] = ['key' => 'lasu', 'name' => $src['name'], 'ok' => false, 'count' => 0, 'error' => $e->getMessage()];
            }
            continue;
        }

        $resp = http_get_external($src['url'], [], 6);
        if (!$resp['ok']) {
            $statuses[] = ['key' => $src['key'], 'name' => $src['name'], 'ok' => false, 'count' => 0, 'error' => $resp['error']];
            continue;
        }
        $parsed = parse_rss_or_atom($resp['body'], $src['key'], $src['name']);
        $statuses[] = ['key' => $src['key'], 'name' => $src['name'], 'ok' => count($parsed) > 0, 'count' => count($parsed)];
        $allItems = array_merge($allItems, $parsed);
    }
}

if ($query !== '') {
    $allItems = array_values(array_filter($allItems, static function (array $item) use ($query): bool {
        $hay = strtolower($item['title'] . ' ' . $item['summary'] . ' ' . $item['source_name']);
        return str_contains($hay, $query);
    }));
}

usort($allItems, static function (array $a, array $b): int {
    return strcmp((string) $b['published_at'], (string) $a['published_at']);
});

json_response([
    'items'          => array_slice($allItems, 0, 60),
    'sourceStatuses' => $statuses,
    'availableSources' => array_map(
        static fn (array $s): array => ['key' => $s['key'], 'name' => $s['name'], 'category' => $s['category']],
        $PRESET_SOURCES
    ),
]);
