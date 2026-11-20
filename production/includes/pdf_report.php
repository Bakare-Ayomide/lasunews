<?php
/**
 * LASU Campus Broadcast - Pure PHP Branded PDF 1.4 Report Builder
 * Zero external dependencies; embeds LASU logo, vector headers, KPI cards,
 * placement breakdowns, and paginated performance tables.
 */

declare(strict_types=1);

final class LasuPdfBuilder
{
    private const PAGE_W_MM = 210.0; // A4 Portrait width
    private const PAGE_H_MM = 297.0; // A4 Portrait height
    private const MM_TO_PT = 2.834645669;

    /** @var string[] */
    private array $pages = [];
    private int $currentPage = -1;

    /** @var array<string, array{data: string, w: int, h: int, name: string}> */
    private array $images = [];

    private float $cursorY = 0.0;

    public function __construct()
    {
        $this->addPage();
    }

    public function getPageWidthMm(): float
    {
        return self::PAGE_W_MM;
    }

    public function getPageHeightMm(): float
    {
        return self::PAGE_H_MM;
    }

    public function getY(): float
    {
        return $this->cursorY;
    }

    public function setY(float $yMm): void
    {
        $this->cursorY = $yMm;
    }

    public function addPage(): void
    {
        $this->pages[] = '';
        $this->currentPage = count($this->pages) - 1;
        $this->cursorY = 14.0;
    }

    public function getPageCount(): int
    {
        return count($this->pages);
    }

    public function setActivePage(int $index): void
    {
        if ($index >= 0 && $index < count($this->pages)) {
            $this->currentPage = $index;
        }
    }

    private function pt(float $mm): float
    {
        return round($mm * self::MM_TO_PT, 3);
    }

    private function pdfY(float $yMm): float
    {
        return round((self::PAGE_H_MM - $yMm) * self::MM_TO_PT, 3);
    }

    private function append(string $cmd): void
    {
        if ($this->currentPage < 0) {
            $this->addPage();
        }
        $this->pages[$this->currentPage] .= $cmd . "\n";
    }

    private function encodeText(string $text): string
    {
        $clean = str_replace(["\r\n", "\r", "\n"], ' ', $text);
        if (function_exists('iconv')) {
            $converted = @iconv('UTF-8', 'Windows-1252//TRANSLIT//IGNORE', $clean);
            if (is_string($converted) && $converted !== '') {
                $clean = $converted;
            }
        }
        $clean = preg_replace('/[^\x20-\xFF]/', '?', $clean) ?? $clean;
        return str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $clean);
    }

    private function hexToRgb(string $hex): array
    {
        $h = ltrim(trim($hex), '#');
        if (strlen($h) !== 6) {
            return [0.0, 0.0, 0.0];
        }
        return [
            round(hexdec(substr($h, 0, 2)) / 255, 4),
            round(hexdec(substr($h, 2, 2)) / 255, 4),
            round(hexdec(substr($h, 4, 2)) / 255, 4),
        ];
    }

    public function drawRect(
        float $xMm,
        float $yMm,
        float $wMm,
        float $hMm,
        ?string $fillHex = null,
        ?string $strokeHex = null,
        float $lineWidthMm = 0.25
    ): void {
        $x = $this->pt($xMm);
        $y = $this->pdfY($yMm + $hMm);
        $w = $this->pt($wMm);
        $h = $this->pt($hMm);

        $this->append('q');
        if ($fillHex !== null) {
            [$r, $g, $b] = $this->hexToRgb($fillHex);
            $this->append(sprintf('%.4F %.4F %.4F rg', $r, $g, $b));
        }
        if ($strokeHex !== null) {
            [$sr, $sg, $sb] = $this->hexToRgb($strokeHex);
            $this->append(sprintf('%.4F %.4F %.4F RG', $sr, $sg, $sb));
            $this->append(sprintf('%.3F w', $this->pt($lineWidthMm)));
        }

        $op = ($fillHex !== null && $strokeHex !== null) ? 'B' : ($fillHex !== null ? 'f' : 'S');
        $this->append(sprintf('%.3F %.3F %.3F %.3F re %s', $x, $y, $w, $h, $op));
        $this->append('Q');
    }

    public function drawLine(float $x1Mm, float $y1Mm, float $x2Mm, float $y2Mm, string $strokeHex = '#E5E2DC', float $widthMm = 0.25): void
    {
        [$r, $g, $b] = $this->hexToRgb($strokeHex);
        $this->append('q');
        $this->append(sprintf('%.4F %.4F %.4F RG', $r, $g, $b));
        $this->append(sprintf('%.3F w', $this->pt($widthMm)));
        $this->append(sprintf('%.3F %.3F m %.3F %.3F l S', $this->pt($x1Mm), $this->pdfY($y1Mm), $this->pt($x2Mm), $this->pdfY($y2Mm)));
        $this->append('Q');
    }

    /**
     * Approximate width in mm for Helvetica/Courier standard PDF fonts.
     */
    public function estimateTextWidthMm(string $text, float $fontSizePt, string $font = 'F1'): float
    {
        $len = mb_strlen($text, 'UTF-8');
        if ($font === 'F4') {
            return ($len * 0.60 * $fontSizePt) / self::MM_TO_PT;
        }
        $factor = ($font === 'F2') ? 0.54 : 0.50;
        return ($len * $factor * $fontSizePt) / self::MM_TO_PT;
    }

    /**
     * Truncate or wrap text to fit within $maxWidthMm.
     * @return string[]
     */
    public function wrapText(string $text, float $maxWidthMm, float $fontSizePt, string $font = 'F1', int $maxLines = 3): array
    {
        $text = trim(preg_replace('/\s+/', ' ', $text) ?? '');
        if ($text === '') {
            return [''];
        }
        $words = explode(' ', $text);
        $lines = [];
        $current = '';

        foreach ($words as $word) {
            $candidate = $current === '' ? $word : $current . ' ' . $word;
            if ($this->estimateTextWidthMm($candidate, $fontSizePt, $font) <= $maxWidthMm) {
                $current = $candidate;
                continue;
            }
            if ($current !== '') {
                $lines[] = $current;
                $current = $word;
            } else {
                // Single long word: slice cleanly
                $lines[] = $this->truncateToWidth($word, $maxWidthMm, $fontSizePt, $font);
                $current = '';
            }
            if (count($lines) >= $maxLines) {
                break;
            }
        }

        if ($current !== '' && count($lines) < $maxLines) {
            $lines[] = $current;
        } elseif ($current !== '' && count($lines) === $maxLines) {
            $last = $lines[$maxLines - 1];
            $lines[$maxLines - 1] = $this->truncateToWidth($last . ' ...', $maxWidthMm, $fontSizePt, $font);
        }

        return $lines;
    }

    public function truncateToWidth(string $text, float $maxWidthMm, float $fontSizePt, string $font = 'F1'): string
    {
        if ($this->estimateTextWidthMm($text, $fontSizePt, $font) <= $maxWidthMm) {
            return $text;
        }
        $out = $text;
        while (mb_strlen($out, 'UTF-8') > 1 && $this->estimateTextWidthMm($out . '...', $fontSizePt, $font) > $maxWidthMm) {
            $out = mb_substr($out, 0, -1, 'UTF-8');
        }
        return rtrim($out) . '...';
    }

    /**
     * Draw single-line text. $font: F1=Helvetica, F2=Helvetica-Bold, F3=Helvetica-Oblique, F4=Courier-Bold
     */
    public function drawText(
        float $xMm,
        float $yBaselineMm,
        string $text,
        float $fontSizePt = 10.0,
        string $colorHex = '#14181F',
        string $font = 'F1',
        string $align = 'left'
    ): void {
        $encoded = $this->encodeText($text);
        $drawX = $xMm;
        if ($align === 'right') {
            $drawX = $xMm - $this->estimateTextWidthMm($text, $fontSizePt, $font);
        } elseif ($align === 'center') {
            $drawX = $xMm - ($this->estimateTextWidthMm($text, $fontSizePt, $font) / 2.0);
        }

        [$r, $g, $b] = $this->hexToRgb($colorHex);
        $this->append('q');
        $this->append(sprintf('BT /%s %.2F Tf %.4F %.4F %.4F rg %.3F %.3F Td (%s) Tj ET',
            $font,
            $fontSizePt,
            $r,
            $g,
            $b,
            $this->pt($drawX),
            $this->pdfY($yBaselineMm),
            $encoded
        ));
        $this->append('Q');
    }

    /**
     * Load a PNG/JPEG file onto a white background JPEG XObject for reliable PDF embedding.
     */
    public function registerLogoImage(string $filePath): ?string
    {
        if (!is_file($filePath) || !function_exists('imagecreatefrompng') || !function_exists('imagejpeg')) {
            return null;
        }

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $src = ($ext === 'jpg' || $ext === 'jpeg') ? @imagecreatefromjpeg($filePath) : @imagecreatefrompng($filePath);
        if (!$src) {
            return null;
        }

        $w = imagesx($src);
        $h = imagesy($src);
        if ($w <= 0 || $h <= 0) {
            imagedestroy($src);
            return null;
        }

        $canvas = imagecreatetruecolor($w, $h);
        $white = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $white);
        imagealphablending($canvas, true);
        imagecopy($canvas, $src, 0, 0, 0, 0, $w, $h);

        ob_start();
        imagejpeg($canvas, null, 95);
        $jpegBytes = (string) ob_get_clean();

        imagedestroy($canvas);
        imagedestroy($src);

        if ($jpegBytes === '') {
            return null;
        }

        $name = 'Im' . (count($this->images) + 1);
        $this->images[$name] = [
            'data' => $jpegBytes,
            'w'    => $w,
            'h'    => $h,
            'name' => $name,
        ];
        return $name;
    }

    public function drawImage(string $imageName, float $xMm, float $yMm, float $wMm, float $hMm): void
    {
        if (!isset($this->images[$imageName])) {
            return;
        }
        $x = $this->pt($xMm);
        $y = $this->pdfY($yMm + $hMm);
        $w = $this->pt($wMm);
        $h = $this->pt($hMm);

        $this->append('q');
        $this->append(sprintf('%.3F 0 0 %.3F %.3F %.3F cm /%s Do', $w, $h, $x, $y, $imageName));
        $this->append('Q');
    }

    public function output(): string
    {
        $objects = [];
        $nextId = 1;
        $alloc = static function () use (&$nextId): int {
            return $nextId++;
        };

        $catalogId = $alloc();
        $pagesId = $alloc();

        // Standard PDF Type1 fonts (zero font-embedding bloat, universally supported)
        $fontIds = [
            'F1' => $alloc(), // Helvetica
            'F2' => $alloc(), // Helvetica-Bold
            'F3' => $alloc(), // Helvetica-Oblique
            'F4' => $alloc(), // Courier-Bold
        ];

        $objects[$fontIds['F1']] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
        $objects[$fontIds['F2']] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
        $objects[$fontIds['F3']] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>';
        $objects[$fontIds['F4']] = '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>';

        $imageObjIds = [];
        foreach ($this->images as $name => $img) {
            $imgId = $alloc();
            $imageObjIds[$name] = $imgId;
            $len = strlen($img['data']);
            $objects[$imgId] = "<< /Type /XObject /Subtype /Image /Width {$img['w']} /Height {$img['h']} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {$len} >>\nstream\n{$img['data']}\nendstream";
        }

        $fontRes = [];
        foreach ($fontIds as $key => $id) {
            $fontRes[] = "/{$key} {$id} 0 R";
        }
        $xobjRes = '';
        if (!empty($imageObjIds)) {
            $parts = [];
            foreach ($imageObjIds as $name => $id) {
                $parts[] = "/{$name} {$id} 0 R";
            }
            $xobjRes = ' /XObject << ' . implode(' ', $parts) . ' >>';
        }
        $resourcesDict = '<< /Font << ' . implode(' ', $fontRes) . ' >>' . $xobjRes . ' >>';

        $pageObjIds = [];
        $pageW = round(self::PAGE_W_MM * self::MM_TO_PT, 2);
        $pageH = round(self::PAGE_H_MM * self::MM_TO_PT, 2);
        $canCompress = function_exists('gzcompress');

        foreach ($this->pages as $streamContent) {
            $contentId = $alloc();
            $pageId = $alloc();
            $pageObjIds[] = $pageId;

            if ($canCompress) {
                $compressed = gzcompress($streamContent, 6);
                if (is_string($compressed)) {
                    $len = strlen($compressed);
                    $objects[$contentId] = "<< /Filter /FlateDecode /Length {$len} >>\nstream\n{$compressed}\nendstream";
                } else {
                    $len = strlen($streamContent);
                    $objects[$contentId] = "<< /Length {$len} >>\nstream\n{$streamContent}\nendstream";
                }
            } else {
                $len = strlen($streamContent);
                $objects[$contentId] = "<< /Length {$len} >>\nstream\n{$streamContent}\nendstream";
            }

            $objects[$pageId] = "<< /Type /Page /Parent {$pagesId} 0 R /MediaBox [0 0 {$pageW} {$pageH}] /Resources {$resourcesDict} /Contents {$contentId} 0 R >>";
        }

        $kids = implode(' ', array_map(static fn(int $id): string => "{$id} 0 R", $pageObjIds));
        $pageCount = count($pageObjIds);
        $objects[$pagesId] = "<< /Type /Pages /Kids [{$kids}] /Count {$pageCount} >>";
        $objects[$catalogId] = "<< /Type /Catalog /Pages {$pagesId} 0 R >>";

        ksort($objects);

        $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
        $offsets = [0 => 0];
        foreach ($objects as $id => $body) {
            $offsets[$id] = strlen($pdf);
            $pdf .= "{$id} 0 obj\n{$body}\nendobj\n";
        }

        $xrefOffset = strlen($pdf);
        $maxId = count($objects) + 1;
        $pdf .= "xref\n0 {$maxId}\n";
        $pdf .= "0000000000 65535 f \n";
        for ($i = 1; $i < $maxId; $i++) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$i]);
        }

        $pdf .= "trailer\n<< /Size {$maxId} /Root {$catalogId} 0 R >>\n";
        $pdf .= "startxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }
}

/**
 * Generate a branded LASU Campus Broadcast Ad Statistics & Performance PDF report.
 */
function build_ads_statistics_pdf(array $ads, array $admin, array $filters = []): string
{
    $pdf = new LasuPdfBuilder();
    $marginL = 14.0;
    $marginR = 14.0;
    $contentW = $pdf->getPageWidthMm() - $marginL - $marginR; // 182mm

    $logoPath = dirname(__DIR__) . '/assets/images/lasu-logo.png';
    $logoImg = $pdf->registerLogoImage($logoPath);

    $placementFilter = (string) ($filters['placement'] ?? 'all');
    $statusFilter = (string) ($filters['status'] ?? 'all');
    $placementLabels = [
        'all'           => 'All Placements',
        'top_banner'    => 'Top Leaderboard Banner',
        'sidebar_box'   => 'Sidebar Notice Box',
        'inline_banner' => 'Inline Feed Banner',
    ];
    $scopeLabel = ($placementLabels[$placementFilter] ?? 'All Placements')
        . ($statusFilter !== 'all' ? ' · Status: ' . ucfirst($statusFilter) : '');

    $generatedAt = date('M j, Y · g:i A') . ' WAT';
    $preparedBy = trim((string) ($admin['full_name'] ?? 'LASU Editorial Admin'));
    $roleLabel = (($admin['role'] ?? 'editor') === 'super_admin') ? 'Super Admin' : 'Editor';

    $drawMasthead = static function (bool $isFirstPage) use ($pdf, $logoImg, $marginL, $contentW, $generatedAt, $preparedBy, $roleLabel, $scopeLabel): void {
        if ($isFirstPage) {
            // Deep LASU Navy header banner + Gold accent border
            $pdf->drawRect(0.0, 0.0, 210.0, 31.0, '#0B2545');
            $pdf->drawRect(0.0, 31.0, 210.0, 1.4, '#B8860B');

            // White brand badge holding LASU Logo (179x49 => ~3.65 ratio)
            $pdf->drawRect($marginL, 6.5, 42.0, 18.0, '#FFFFFF', '#E5C158', 0.35);
            if ($logoImg !== null) {
                // 179:49 aspect -> w=36mm, h=9.85mm centered inside 42x18 card
                $pdf->drawImage($logoImg, $marginL + 3.0, 10.6, 36.0, 9.85);
            } else {
                $pdf->drawText($marginL + 21.0, 14.5, 'LASU', 13.0, '#0B2545', 'F2', 'center');
                $pdf->drawText($marginL + 21.0, 20.0, 'CAMPUS NEWS', 6.5, '#B8860B', 'F2', 'center');
            }

            $textX = $marginL + 47.0;
            $pdf->drawText($textX, 11.5, 'LAGOS STATE UNIVERSITY · CAMPUS BROADCASTING SYSTEM', 7.2, '#E5C158', 'F2');
            $pdf->drawText($textX, 18.5, 'Advertisement Performance & Statistics Report', 15.0, '#FFFFFF', 'F2');
            $pdf->drawText(
                $textX,
                25.0,
                "Generated: {$generatedAt}   |   By: {$preparedBy} ({$roleLabel})   |   Scope: {$scopeLabel}",
                7.6,
                '#CBD5E1',
                'F1'
            );
            $pdf->setY(39.0);
        } else {
            // Compact continuation header on pages 2+
            $pdf->drawRect(0.0, 0.0, 210.0, 14.0, '#0B2545');
            $pdf->drawRect(0.0, 14.0, 210.0, 0.8, '#B8860B');
            $pdf->drawText($marginL, 9.0, 'LASU CAMPUS BROADCAST — ADVERTISEMENT PERFORMANCE REPORT (CONTINUED)', 8.2, '#FFFFFF', 'F2');
            $pdf->drawText($marginL + $contentW, 9.0, $generatedAt, 7.5, '#E5C158', 'F1', 'right');
            $pdf->setY(21.0);
        }
    };

    $drawMasthead(true);

    // Compute aggregate statistics
    $nowMs = time() * 1000;
    $totalAds = count($ads);
    $activeCount = 0;
    $pausedCount = 0;
    $expiredCount = 0;
    $totalImpressions = 0;
    $totalClicks = 0;
    $topClicksAd = null;
    $topImprAd = null;
    $bestCtrAd = null;
    $bestCtrVal = -1.0;

    $placementAgg = [
        'top_banner'    => ['label' => 'Top Leaderboard Banner', 'total' => 0, 'active' => 0, 'impressions' => 0, 'clicks' => 0],
        'sidebar_box'   => ['label' => 'Sidebar Notice Box', 'total' => 0, 'active' => 0, 'impressions' => 0, 'clicks' => 0],
        'inline_banner' => ['label' => 'Inline Feed Banner', 'total' => 0, 'active' => 0, 'impressions' => 0, 'clicks' => 0],
    ];

    $enrichedAds = [];
    foreach ($ads as $ad) {
        $impr = (int) ($ad['impressions'] ?? 0);
        $clicks = (int) ($ad['clicks'] ?? 0);
        $expMs = isset($ad['expires_at_ms']) && $ad['expires_at_ms'] !== null ? (int) $ad['expires_at_ms'] : null;
        $isExpired = ($expMs !== null && $expMs <= $nowMs);
        $isActive = (($ad['status'] ?? '') === 'active') && !$isExpired;
        $ctr = $impr > 0 ? (($clicks / $impr) * 100.0) : 0.0;

        if ($isExpired) {
            $expiredCount++;
        } elseif (($ad['status'] ?? '') === 'active') {
            $activeCount++;
        } else {
            $pausedCount++;
        }

        $totalImpressions += $impr;
        $totalClicks += $clicks;

        $pl = (string) ($ad['placement'] ?? 'sidebar_box');
        if (!isset($placementAgg[$pl])) {
            $placementAgg[$pl] = ['label' => $pl, 'total' => 0, 'active' => 0, 'impressions' => 0, 'clicks' => 0];
        }
        $placementAgg[$pl]['total']++;
        if ($isActive) {
            $placementAgg[$pl]['active']++;
        }
        $placementAgg[$pl]['impressions'] += $impr;
        $placementAgg[$pl]['clicks'] += $clicks;

        if ($topClicksAd === null || $clicks > (int) $topClicksAd['clicks']) {
            $topClicksAd = ['title' => (string) $ad['title'], 'clicks' => $clicks, 'impressions' => $impr];
        }
        if ($topImprAd === null || $impr > (int) $topImprAd['impressions']) {
            $topImprAd = ['title' => (string) $ad['title'], 'impressions' => $impr, 'clicks' => $clicks];
        }
        if ($impr > 0 && $ctr > $bestCtrVal) {
            $bestCtrVal = $ctr;
            $bestCtrAd = ['title' => (string) $ad['title'], 'ctr' => $ctr, 'clicks' => $clicks, 'impressions' => $impr];
        }

        $ad['_impr'] = $impr;
        $ad['_clicks'] = $clicks;
        $ad['_ctr'] = $ctr;
        $ad['_is_expired'] = $isExpired;
        $ad['_is_active'] = $isActive;
        $ad['_exp_ms'] = $expMs;
        $enrichedAds[] = $ad;
    }

    $overallCtr = $totalImpressions > 0 ? number_format(($totalClicks / $totalImpressions) * 100.0, 2) . '%' : '0.00%';

    // Section 1: Executive Summary KPI Cards
    $y = $pdf->getY();
    $pdf->drawText($marginL, $y, 'EXECUTIVE SUMMARY', 8.5, '#0B2545', 'F2');
    $pdf->drawLine($marginL + 36.0, $y - 1.0, $marginL + $contentW, $y - 1.0, '#E5E2DC', 0.3);
    $y += 4.5;

    $cardGap = 3.5;
    $cardW = ($contentW - ($cardGap * 3)) / 4.0;
    $cardH = 22.0;

    $cards = [
        [
            'label' => 'TOTAL CAMPAIGNS',
            'val'   => number_format($totalAds),
            'sub'   => "{$activeCount} active · {$pausedCount} paused · {$expiredCount} expired",
            'accent' => '#0B2545',
        ],
        [
            'label' => 'TOTAL IMPRESSIONS',
            'val'   => number_format($totalImpressions),
            'sub'   => 'Verified ad slot renders',
            'accent' => '#0F766E',
        ],
        [
            'label' => 'TOTAL CLICKS',
            'val'   => number_format($totalClicks),
            'sub'   => $topClicksAd ? 'Best: ' . $pdf->truncateToWidth($topClicksAd['title'], $cardW - 8.0, 6.8, 'F1') : 'No clicks logged',
            'accent' => '#B8860B',
        ],
        [
            'label' => 'OVERALL CTR',
            'val'   => $overallCtr,
            'sub'   => 'Click-through conversion rate',
            'accent' => '#6D28D9',
        ],
    ];

    foreach ($cards as $i => $c) {
        $cx = $marginL + $i * ($cardW + $cardGap);
        $pdf->drawRect($cx, $y, $cardW, $cardH, '#FAF9F6', '#E5E2DC', 0.25);
        $pdf->drawRect($cx, $y, $cardW, 1.3, $c['accent']);
        $pdf->drawText($cx + 3.5, $y + 6.0, $c['label'], 6.6, '#525866', 'F2');
        $pdf->drawText($cx + 3.5, $y + 13.5, $c['val'], 14.5, '#14181F', 'F2');
        $pdf->drawText($cx + 3.5, $y + 19.0, $pdf->truncateToWidth($c['sub'], $cardW - 7.0, 6.7, 'F1'), 6.7, '#525866', 'F1');
    }

    $y += $cardH + 8.5;

    // Section 2: Placement Performance Breakdown
    $pdf->drawText($marginL, $y, 'PLACEMENT SPACE BREAKDOWN', 8.5, '#0B2545', 'F2');
    $pdf->drawLine($marginL + 50.0, $y - 1.0, $marginL + $contentW, $y - 1.0, '#E5E2DC', 0.3);
    $y += 4.5;

    $plCols = [
        ['label' => 'Placement Space', 'w' => 56.0, 'align' => 'left'],
        ['label' => 'Total / Active', 'w' => 28.0, 'align' => 'right'],
        ['label' => 'Impressions', 'w' => 28.0, 'align' => 'right'],
        ['label' => 'Clicks', 'w' => 22.0, 'align' => 'right'],
        ['label' => 'CTR', 'w' => 20.0, 'align' => 'right'],
        ['label' => 'Impr. Share', 'w' => 28.0, 'align' => 'right'],
    ];

    // Table header
    $pdf->drawRect($marginL, $y, $contentW, 7.5, '#0B2545');
    $hx = $marginL;
    foreach ($plCols as $col) {
        $tx = $col['align'] === 'right' ? ($hx + $col['w'] - 3.0) : ($hx + 3.0);
        $pdf->drawText($tx, $y + 5.0, $col['label'], 7.6, '#FFFFFF', 'F2', $col['align']);
        $hx += $col['w'];
    }
    $y += 7.5;

    $plIdx = 0;
    foreach ($placementAgg as $plKey => $agg) {
        if ($placementFilter !== 'all' && $plKey !== $placementFilter) {
            continue;
        }
        $bg = ($plIdx % 2 === 0) ? '#FFFFFF' : '#FAF9F6';
        $pdf->drawRect($marginL, $y, $contentW, 7.5, $bg, '#E5E2DC', 0.2);

        $plCtr = $agg['impressions'] > 0 ? number_format(($agg['clicks'] / $agg['impressions']) * 100.0, 2) . '%' : '0.00%';
        $sharePct = $totalImpressions > 0 ? number_format(($agg['impressions'] / $totalImpressions) * 100.0, 1) . '%' : '0.0%';

        $vals = [
            $agg['label'],
            "{$agg['total']} / {$agg['active']} live",
            number_format($agg['impressions']),
            number_format($agg['clicks']),
            $plCtr,
            $sharePct,
        ];
        $cx = $marginL;
        foreach ($plCols as $cIdx => $col) {
            $tx = $col['align'] === 'right' ? ($cx + $col['w'] - 3.0) : ($cx + 3.0);
            $font = $cIdx === 0 ? 'F2' : ($cIdx >= 2 ? 'F4' : 'F1');
            $pdf->drawText($tx, $y + 5.1, $vals[$cIdx], 7.8, '#14181F', $font, $col['align']);
            $cx += $col['w'];
        }
        $y += 7.5;
        $plIdx++;
    }

    // Placement Totals Row
    $pdf->drawRect($marginL, $y, $contentW, 7.5, '#F3F4F6', '#D1CCC4', 0.25);
    $totVals = [
        'All Selected Placements',
        "{$totalAds} / {$activeCount} live",
        number_format($totalImpressions),
        number_format($totalClicks),
        $overallCtr,
        $totalImpressions > 0 ? '100.0%' : '0.0%',
    ];
    $cx = $marginL;
    foreach ($plCols as $cIdx => $col) {
        $tx = $col['align'] === 'right' ? ($cx + $col['w'] - 3.0) : ($cx + 3.0);
        $font = $cIdx >= 2 ? 'F4' : 'F2';
        $pdf->drawText($tx, $y + 5.1, $totVals[$cIdx], 7.8, '#0B2545', $font, $col['align']);
        $cx += $col['w'];
    }
    $y += 14.0;

    // Section 3: Top Performers Strip (if data exists)
    if ($totalAds > 0) {
        $pdf->drawText($marginL, $y, 'CAMPAIGN HIGHLIGHTS', 8.5, '#0B2545', 'F2');
        $pdf->drawLine($marginL + 39.0, $y - 1.0, $marginL + $contentW, $y - 1.0, '#E5E2DC', 0.3);
        $y += 4.5;

        $hGap = 3.5;
        $hW = ($contentW - ($hGap * 2)) / 3.0;
        $hH = 16.5;
        $highlights = [
            [
                'kicker' => 'MOST CLICKED CAMPAIGN',
                'title'  => $topClicksAd ? $topClicksAd['title'] : '—',
                'stat'   => $topClicksAd ? number_format($topClicksAd['clicks']) . ' clicks (' . number_format($topClicksAd['impressions']) . ' impr.)' : 'No clicks yet',
            ],
            [
                'kicker' => 'HIGHEST REACH (IMPRESSIONS)',
                'title'  => $topImprAd ? $topImprAd['title'] : '—',
                'stat'   => $topImprAd ? number_format($topImprAd['impressions']) . ' impressions' : 'No impressions yet',
            ],
            [
                'kicker' => 'BEST CONVERSION (CTR)',
                'title'  => $bestCtrAd ? $bestCtrAd['title'] : '—',
                'stat'   => $bestCtrAd ? number_format($bestCtrAd['ctr'], 2) . '% CTR (' . $bestCtrAd['clicks'] . '/' . $bestCtrAd['impressions'] . ')' : 'Awaiting impressions',
            ],
        ];
        foreach ($highlights as $hi => $hl) {
            $hx = $marginL + $hi * ($hW + $hGap);
            $pdf->drawRect($hx, $y, $hW, $hH, '#FFFFFF', '#E5E2DC', 0.25);
            $pdf->drawText($hx + 3.0, $y + 5.0, $hl['kicker'], 6.5, '#B8860B', 'F2');
            $pdf->drawText($hx + 3.0, $y + 10.0, $pdf->truncateToWidth($hl['title'], $hW - 6.0, 8.0, 'F2'), 8.0, '#14181F', 'F2');
            $pdf->drawText($hx + 3.0, $y + 14.3, $pdf->truncateToWidth($hl['stat'], $hW - 6.0, 7.0, 'F1'), 7.0, '#525866', 'F1');
        }
        $y += $hH + 9.0;
    }

    // Section 4: Complete Campaign Ledger
    $pdf->drawText($marginL, $y, 'CAMPAIGN PERFORMANCE LEDGER', 8.5, '#0B2545', 'F2');
    $pdf->drawLine($marginL + 56.0, $y - 1.0, $marginL + $contentW, $y - 1.0, '#E5E2DC', 0.3);
    $y += 4.5;

    // 182mm total width across 7 columns
    $cols = [
        ['label' => '#', 'w' => 9.0, 'align' => 'left'],
        ['label' => 'Campaign & Sponsor', 'w' => 57.0, 'align' => 'left'],
        ['label' => 'Placement & Slot', 'w' => 30.0, 'align' => 'left'],
        ['label' => 'Status & Duration', 'w' => 38.0, 'align' => 'left'],
        ['label' => 'Impr.', 'w' => 17.0, 'align' => 'right'],
        ['label' => 'Clicks', 'w' => 15.0, 'align' => 'right'],
        ['label' => 'CTR', 'w' => 16.0, 'align' => 'right'],
    ];

    $drawLedgerHeader = static function () use ($pdf, $marginL, $contentW, $cols, &$y): void {
        $pdf->drawRect($marginL, $y, $contentW, 7.5, '#0B2545');
        $cx = $marginL;
        foreach ($cols as $col) {
            $tx = $col['align'] === 'right' ? ($cx + $col['w'] - 2.5) : ($cx + 2.5);
            $pdf->drawText($tx, $y + 5.0, $col['label'], 7.4, '#FFFFFF', 'F2', $col['align']);
            $cx += $col['w'];
        }
        $y += 7.5;
    };

    $drawLedgerHeader();

    $footerReserveY = $pdf->getPageHeightMm() - 18.0;

    if (empty($enrichedAds)) {
        $pdf->drawRect($marginL, $y, $contentW, 14.0, '#FAF9F6', '#E5E2DC', 0.25);
        $pdf->drawText($marginL + ($contentW / 2.0), $y + 8.5, 'No advertisement campaigns matched the selected report scope.', 8.5, '#525866', 'F3', 'center');
    } else {
        $placementShort = [
            'top_banner'    => 'Top Banner',
            'sidebar_box'   => 'Sidebar Box',
            'inline_banner' => 'Inline Banner',
        ];

        foreach ($enrichedAds as $idx => $ad) {
            $titleLines = $pdf->wrapText((string) $ad['title'], 52.0, 7.8, 'F2', 2);
            $rowH = max(11.5, 6.0 + (count($titleLines) * 3.5) + 3.5);

            if ($y + $rowH > $footerReserveY) {
                $pdf->addPage();
                $drawMasthead(false);
                $y = $pdf->getY();
                $drawLedgerHeader();
            }

            $bg = ($idx % 2 === 0) ? '#FFFFFF' : '#FAF9F6';
            $pdf->drawRect($marginL, $y, $contentW, $rowH, $bg, '#E5E2DC', 0.2);

            // Col 0: #
            $cx = $marginL;
            $pdf->drawText($cx + 2.5, $y + 5.0, (string) ($idx + 1), 7.5, '#525866', 'F4');
            $cx += $cols[0]['w'];

            // Col 1: Title + Advertiser
            $ty = $y + 4.8;
            foreach ($titleLines as $tLine) {
                $pdf->drawText($cx + 2.5, $ty, $tLine, 7.8, '#14181F', 'F2');
                $ty += 3.5;
            }
            $pdf->drawText(
                $cx + 2.5,
                $ty + 0.5,
                $pdf->truncateToWidth((string) ($ad['advertiser_name'] ?? ''), 52.0, 6.9, 'F1'),
                6.9,
                '#525866',
                'F1'
            );
            $cx += $cols[1]['w'];

            // Col 2: Placement + Slot Order
            $plText = $placementShort[(string) $ad['placement']] ?? (string) $ad['placement'];
            $slotText = 'Slot #' . (int) ($ad['display_order'] ?? 0);
            $pdf->drawText($cx + 2.5, $y + 4.8, $plText, 7.5, '#14181F', 'F1');
            $pdf->drawText($cx + 2.5, $y + 8.8, $slotText, 6.9, '#525866', 'F4');
            $cx += $cols[2]['w'];

            // Col 3: Status + Duration/Expiry
            if ($ad['_is_expired']) {
                $stLabel = 'EXPIRED';
                $stColor = '#B91C1C';
            } elseif (($ad['status'] ?? '') === 'active') {
                $stLabel = 'ACTIVE';
                $stColor = '#047857';
            } else {
                $stLabel = 'PAUSED';
                $stColor = '#B45309';
            }
            $durUnit = (string) ($ad['duration_unit'] ?? 'none');
            $durVal = (int) ($ad['duration_value'] ?? 0);
            if ($durUnit !== 'none' && $durVal > 0) {
                $durSub = "{$durVal} {$durUnit}" . (!empty($ad['expires_at']) ? ' · ' . substr((string) $ad['expires_at'], 0, 16) : '');
            } else {
                $durSub = 'Unlimited duration';
            }
            $pdf->drawText($cx + 2.5, $y + 4.8, $stLabel, 7.4, $stColor, 'F2');
            $pdf->drawText(
                $cx + 2.5,
                $y + 8.8,
                $pdf->truncateToWidth($durSub, 33.5, 6.6, 'F1'),
                6.6,
                '#525866',
                'F1'
            );
            $cx += $cols[3]['w'];

            // Col 4: Impressions
            $pdf->drawText($cx + $cols[4]['w'] - 2.5, $y + 5.5, number_format($ad['_impr']), 7.8, '#14181F', 'F4', 'right');
            $cx += $cols[4]['w'];

            // Col 5: Clicks
            $pdf->drawText($cx + $cols[5]['w'] - 2.5, $y + 5.5, number_format($ad['_clicks']), 7.8, '#14181F', 'F4', 'right');
            $cx += $cols[5]['w'];

            // Col 6: CTR
            $ctrStr = number_format($ad['_ctr'], 2) . '%';
            $pdf->drawText($cx + $cols[6]['w'] - 2.5, $y + 5.5, $ctrStr, 7.8, '#0B2545', 'F4', 'right');

            $y += $rowH;
        }
    }

    // Stamp consistent footer across every page with exact Page X of Y
    $totalPages = $pdf->getPageCount();
    $footerY = $pdf->getPageHeightMm() - 10.0;
    for ($p = 0; $p < $totalPages; $p++) {
        $pdf->setActivePage($p);
        $pdf->drawLine($marginL, $footerY - 4.0, $marginL + $contentW, $footerY - 4.0, '#E5E2DC', 0.25);
        $pdf->drawText(
            $marginL,
            $footerY,
            'LASU Campus Broadcast · Directorate of Information & Public Relations · Official Advertisement Report',
            7.0,
            '#525866',
            'F1'
        );
        $pdf->drawText(
            $marginL + $contentW,
            $footerY,
            'Page ' . ($p + 1) . ' of ' . $totalPages,
            7.2,
            '#0B2545',
            'F2',
            'right'
        );
    }

    return $pdf->output();
}
