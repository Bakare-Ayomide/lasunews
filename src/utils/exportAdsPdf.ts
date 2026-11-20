import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AdminUser, Advertisement } from '../types.ts';

export interface ExportAdsPdfOptions {
  ads: Advertisement[];
  admin: AdminUser;
  placementFilter?: 'all' | 'top_banner' | 'sidebar_box' | 'inline_banner';
  statusFilter?: 'all' | 'active' | 'paused' | 'expired';
}

function getExpiresAtMs(ad: Advertisement): number | null {
  if (typeof ad.expires_at_ms === 'number' && Number.isFinite(ad.expires_at_ms)) {
    return ad.expires_at_ms;
  }
  if (ad.expires_at) {
    const parsed = Date.parse(ad.expires_at.replace(' ', 'T') + 'Z');
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

async function loadLogoDataUrl(): Promise<string | null> {
  const candidates = ['/assets/lasu-logo.png', 'https://bobodhouhertyoflasu.com.ng/logo/lasulogo.png'];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
      if (dataUrl) return dataUrl;
    } catch {
      // Try next candidate
    }
  }
  return null;
}

export async function exportAdsStatisticsPdf({
  ads,
  admin,
  placementFilter = 'all',
  statusFilter = 'all',
}: ExportAdsPdfOptions): Promise<string> {
  const nowMs = Date.now();

  const filtered = ads.filter((ad) => {
    if (placementFilter !== 'all' && ad.placement !== placementFilter) return false;
    const expMs = getExpiresAtMs(ad);
    const isExpired = expMs !== null && expMs <= nowMs;
    if (statusFilter === 'expired' && !isExpired) return false;
    if (statusFilter === 'active' && (ad.status !== 'active' || isExpired)) return false;
    if (statusFilter === 'paused' && (ad.status !== 'paused' || isExpired)) return false;
    return true;
  });

  const placementLabels: Record<string, string> = {
    all: 'All Placements',
    top_banner: 'Top Leaderboard Banner',
    sidebar_box: 'Sidebar Notice Box',
    inline_banner: 'Inline Feed Banner',
  };

  const placementShort: Record<string, string> = {
    top_banner: 'Top Banner',
    sidebar_box: 'Sidebar Box',
    inline_banner: 'Inline Banner',
  };

  const scopeLabel =
    (placementLabels[placementFilter] || 'All Placements') +
    (statusFilter !== 'all' ? ` · Status: ${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}` : '');

  const nowDate = new Date();
  const generatedAt = nowDate.toLocaleString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const roleLabel = admin.role === 'super_admin' ? 'Super Admin' : 'Editor';

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const logoDataUrl = await loadLogoDataUrl();
  const pageW = doc.internal.pageSize.getWidth(); // 210
  const pageH = doc.internal.pageSize.getHeight(); // 297
  const marginL = 14;
  const marginR = 14;
  const contentW = pageW - marginL - marginR; // 182

  const drawMasthead = (isFirstPage: boolean) => {
    if (isFirstPage) {
      doc.setFillColor(11, 37, 69); // #0B2545 LASU Navy
      doc.rect(0, 0, pageW, 31, 'F');
      doc.setFillColor(184, 134, 11); // #B8860B LASU Gold
      doc.rect(0, 31, pageW, 1.4, 'F');

      // White card holding LASU logo
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(229, 193, 88);
      doc.setLineWidth(0.35);
      doc.rect(marginL, 6.5, 42, 18, 'FD');
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', marginL + 3, 10.6, 36, 9.85);
      } else {
        doc.setTextColor(11, 37, 69);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.text('LASU', marginL + 21, 14.5, { align: 'center' });
        doc.setTextColor(184, 134, 11);
        doc.setFontSize(6.5);
        doc.text('CAMPUS NEWS', marginL + 21, 20, { align: 'center' });
      }

      const textX = marginL + 47;
      doc.setTextColor(229, 193, 88);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.text('LAGOS STATE UNIVERSITY · CAMPUS BROADCASTING SYSTEM', textX, 11.5);

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text('Advertisement Performance & Statistics Report', textX, 18.5);

      doc.setTextColor(203, 213, 225);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.6);
      doc.text(
        `Generated: ${generatedAt}   |   By: ${admin.full_name} (${roleLabel})   |   Scope: ${scopeLabel}`,
        textX,
        25
      );
    } else {
      doc.setFillColor(11, 37, 69);
      doc.rect(0, 0, pageW, 14, 'F');
      doc.setFillColor(184, 134, 11);
      doc.rect(0, 14, pageW, 0.8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.2);
      doc.text('LASU CAMPUS BROADCAST — ADVERTISEMENT PERFORMANCE REPORT (CONTINUED)', marginL, 9);
      doc.setTextColor(229, 193, 88);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text(generatedAt, marginL + contentW, 9, { align: 'right' });
    }
  };

  drawMasthead(true);

  // Compute aggregate stats
  let activeCount = 0;
  let pausedCount = 0;
  let expiredCount = 0;
  let totalImpressions = 0;
  let totalClicks = 0;

  let topClicksAd: { title: string; clicks: number; impressions: number } | null = null;
  let topImprAd: { title: string; impressions: number; clicks: number } | null = null;
  let bestCtrAd: { title: string; ctr: number; clicks: number; impressions: number } | null = null;

  const placementAgg: Record<
    string,
    { label: string; total: number; active: number; impressions: number; clicks: number }
  > = {
    top_banner: { label: 'Top Leaderboard Banner', total: 0, active: 0, impressions: 0, clicks: 0 },
    sidebar_box: { label: 'Sidebar Notice Box', total: 0, active: 0, impressions: 0, clicks: 0 },
    inline_banner: { label: 'Inline Feed Banner', total: 0, active: 0, impressions: 0, clicks: 0 },
  };

  for (const ad of filtered) {
    const impr = Number(ad.impressions || 0);
    const clicks = Number(ad.clicks || 0);
    const expMs = getExpiresAtMs(ad);
    const isExpired = expMs !== null && expMs <= nowMs;
    const isActive = ad.status === 'active' && !isExpired;
    const ctr = impr > 0 ? (clicks / impr) * 100 : 0;

    if (isExpired) expiredCount++;
    else if (ad.status === 'active') activeCount++;
    else pausedCount++;

    totalImpressions += impr;
    totalClicks += clicks;

    const bucket = placementAgg[ad.placement];
    if (bucket) {
      bucket.total++;
      if (isActive) bucket.active++;
      bucket.impressions += impr;
      bucket.clicks += clicks;
    }

    if (!topClicksAd || clicks > topClicksAd.clicks) {
      topClicksAd = { title: ad.title, clicks, impressions: impr };
    }
    if (!topImprAd || impr > topImprAd.impressions) {
      topImprAd = { title: ad.title, impressions: impr, clicks };
    }
    if (impr > 0 && (!bestCtrAd || ctr > bestCtrAd.ctr)) {
      bestCtrAd = { title: ad.title, ctr, clicks, impressions: impr };
    }
  }

  const overallCtr = totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(2)}%` : '0.00%';

  // Section 1: Executive Summary KPI Cards
  let y = 39;
  doc.setTextColor(11, 37, 69);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('EXECUTIVE SUMMARY', marginL, y);
  doc.setDrawColor(229, 226, 220);
  doc.setLineWidth(0.3);
  doc.line(marginL + 36, y - 1, marginL + contentW, y - 1);
  y += 4.5;

  const cardGap = 3.5;
  const cardW = (contentW - cardGap * 3) / 4;
  const cardH = 22;

  const kpiCards = [
    {
      label: 'TOTAL CAMPAIGNS',
      val: filtered.length.toLocaleString(),
      sub: `${activeCount} active · ${pausedCount} paused · ${expiredCount} exp.`,
      accent: [11, 37, 69] as const,
    },
    {
      label: 'TOTAL IMPRESSIONS',
      val: totalImpressions.toLocaleString(),
      sub: 'Verified ad slot renders',
      accent: [15, 118, 110] as const,
    },
    {
      label: 'TOTAL CLICKS',
      val: totalClicks.toLocaleString(),
      sub: topClicksAd ? `Best: ${topClicksAd.title.slice(0, 22)}` : 'No clicks logged',
      accent: [184, 134, 11] as const,
    },
    {
      label: 'OVERALL CTR',
      val: overallCtr,
      sub: 'Click-through conversion rate',
      accent: [109, 40, 217] as const,
    },
  ];

  kpiCards.forEach((c, idx) => {
    const cx = marginL + idx * (cardW + cardGap);
    doc.setFillColor(250, 249, 246);
    doc.setDrawColor(229, 226, 220);
    doc.setLineWidth(0.25);
    doc.rect(cx, y, cardW, cardH, 'FD');

    doc.setFillColor(c.accent[0], c.accent[1], c.accent[2]);
    doc.rect(cx, y, cardW, 1.3, 'F');

    doc.setTextColor(82, 88, 102);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.6);
    doc.text(c.label, cx + 3.5, y + 6);

    doc.setTextColor(20, 24, 31);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(c.val, cx + 3.5, y + 13.5);

    doc.setTextColor(82, 88, 102);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.text(c.sub, cx + 3.5, y + 19, { maxWidth: cardW - 7 });
  });

  y += cardH + 8.5;

  // Section 2: Placement Performance Breakdown
  doc.setTextColor(11, 37, 69);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('PLACEMENT SPACE BREAKDOWN', marginL, y);
  doc.setDrawColor(229, 226, 220);
  doc.line(marginL + 50, y - 1, marginL + contentW, y - 1);
  y += 3.5;

  const placementRows = Object.entries(placementAgg)
    .filter(([key]) => placementFilter === 'all' || key === placementFilter)
    .map(([, agg]) => {
      const ctr = agg.impressions > 0 ? `${((agg.clicks / agg.impressions) * 100).toFixed(2)}%` : '0.00%';
      const share = totalImpressions > 0 ? `${((agg.impressions / totalImpressions) * 100).toFixed(1)}%` : '0.0%';
      return [
        agg.label,
        `${agg.total} / ${agg.active} live`,
        agg.impressions.toLocaleString(),
        agg.clicks.toLocaleString(),
        ctr,
        share,
      ];
    });

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR, top: 21 },
    head: [['Placement Space', 'Total / Active', 'Impressions', 'Clicks', 'CTR', 'Impr. Share']],
    body: placementRows,
    foot: [
      [
        'All Selected Placements',
        `${filtered.length} / ${activeCount} live`,
        totalImpressions.toLocaleString(),
        totalClicks.toLocaleString(),
        overallCtr,
        totalImpressions > 0 ? '100.0%' : '0.0%',
      ],
    ],
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.8,
      cellPadding: 2.2,
      lineColor: [229, 226, 220],
      lineWidth: 0.2,
      textColor: [20, 24, 31],
    },
    headStyles: {
      fillColor: [11, 37, 69],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [11, 37, 69],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 249, 246],
    },
    columnStyles: {
      0: { cellWidth: 56, fontStyle: 'bold' },
      1: { cellWidth: 28, halign: 'right' },
      2: { cellWidth: 28, halign: 'right', font: 'courier' },
      3: { cellWidth: 22, halign: 'right', font: 'courier' },
      4: { cellWidth: 20, halign: 'right', font: 'courier' },
      5: { cellWidth: 28, halign: 'right', font: 'courier' },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7.5;

  // Section 3: Campaign Highlights
  if (filtered.length > 0) {
    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('CAMPAIGN HIGHLIGHTS', marginL, y);
    doc.setDrawColor(229, 226, 220);
    doc.line(marginL + 39, y - 1, marginL + contentW, y - 1);
    y += 4;

    const hGap = 3.5;
    const hW = (contentW - hGap * 2) / 3;
    const hH = 16.5;
    const highlights = [
      {
        kicker: 'MOST CLICKED CAMPAIGN',
        title: topClicksAd ? topClicksAd.title : '—',
        stat: topClicksAd
          ? `${topClicksAd.clicks.toLocaleString()} clicks (${topClicksAd.impressions.toLocaleString()} impr.)`
          : 'No clicks yet',
      },
      {
        kicker: 'HIGHEST REACH (IMPRESSIONS)',
        title: topImprAd ? topImprAd.title : '—',
        stat: topImprAd ? `${topImprAd.impressions.toLocaleString()} impressions` : 'No impressions yet',
      },
      {
        kicker: 'BEST CONVERSION (CTR)',
        title: bestCtrAd ? bestCtrAd.title : '—',
        stat: bestCtrAd
          ? `${bestCtrAd.ctr.toFixed(2)}% CTR (${bestCtrAd.clicks}/${bestCtrAd.impressions})`
          : 'Awaiting impressions',
      },
    ];

    highlights.forEach((hl, idx) => {
      const hx = marginL + idx * (hW + hGap);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(229, 226, 220);
      doc.rect(hx, y, hW, hH, 'FD');

      doc.setTextColor(184, 134, 11);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.text(hl.kicker, hx + 3, y + 5);

      doc.setTextColor(20, 24, 31);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.8);
      doc.text(hl.title.length > 30 ? `${hl.title.slice(0, 29)}…` : hl.title, hx + 3, y + 10);

      doc.setTextColor(82, 88, 102);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.9);
      doc.text(hl.stat, hx + 3, y + 14.3, { maxWidth: hW - 6 });
    });

    y += hH + 8;
  }

  // Section 4: Complete Campaign Ledger
  doc.setTextColor(11, 37, 69);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CAMPAIGN PERFORMANCE LEDGER', marginL, y);
  doc.setDrawColor(229, 226, 220);
  doc.line(marginL + 56, y - 1, marginL + contentW, y - 1);
  y += 3.5;

  const ledgerRows =
    filtered.length === 0
      ? [['', 'No advertisement campaigns matched the selected report scope.', '', '', '', '', '']]
      : filtered.map((ad, idx) => {
          const impr = Number(ad.impressions || 0);
          const clicks = Number(ad.clicks || 0);
          const ctr = impr > 0 ? `${((clicks / impr) * 100).toFixed(2)}%` : '0.00%';
          const expMs = getExpiresAtMs(ad);
          const isExpired = expMs !== null && expMs <= nowMs;
          const statusLabel = isExpired ? 'EXPIRED' : ad.status.toUpperCase();
          const hasLimit = ad.duration_unit && ad.duration_unit !== 'none' && Number(ad.duration_value || 0) > 0;
          const durText = hasLimit
            ? `${ad.duration_value} ${ad.duration_unit}${ad.expires_at ? ` · ${String(ad.expires_at).slice(0, 16)}` : ''}`
            : 'Unlimited';

          return [
            String(idx + 1),
            `${ad.title}\n${ad.advertiser_name}`,
            `${placementShort[ad.placement] || ad.placement}\nSlot #${ad.display_order ?? 0}`,
            `${statusLabel}\n${durText}`,
            impr.toLocaleString(),
            clicks.toLocaleString(),
            ctr,
          ];
        });

  autoTable(doc, {
    startY: y,
    margin: { left: marginL, right: marginR, top: 21, bottom: 18 },
    head: [['#', 'Campaign & Sponsor', 'Placement & Slot', 'Status & Duration', 'Impr.', 'Clicks', 'CTR']],
    body: ledgerRows,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2.2,
      lineColor: [229, 226, 220],
      lineWidth: 0.2,
      textColor: [20, 24, 31],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [11, 37, 69],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [250, 249, 246],
    },
    columnStyles: {
      0: { cellWidth: 9, font: 'courier', textColor: [82, 88, 102] },
      1: { cellWidth: 57 },
      2: { cellWidth: 30 },
      3: { cellWidth: 38 },
      4: { cellWidth: 17, halign: 'right', font: 'courier' },
      5: { cellWidth: 15, halign: 'right', font: 'courier' },
      6: { cellWidth: 16, halign: 'right', font: 'courier', textColor: [11, 37, 69], fontStyle: 'bold' },
    },
    didParseCell(data) {
      if (data.section === 'body' && data.column.index === 3 && typeof data.cell.raw === 'string') {
        if (data.cell.raw.startsWith('EXPIRED')) {
          data.cell.styles.textColor = [185, 28, 28];
        } else if (data.cell.raw.startsWith('ACTIVE')) {
          data.cell.styles.textColor = [4, 120, 87];
        } else {
          data.cell.styles.textColor = [180, 83, 9];
        }
      }
    },
    didDrawPage(data) {
      if (data.pageNumber > 1) {
        drawMasthead(false);
      }
    },
  });

  // Stamp footer + Page X of Y on all pages
  const totalPages = doc.getNumberOfPages();
  const footerY = pageH - 10;
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setDrawColor(229, 226, 220);
    doc.setLineWidth(0.25);
    doc.line(marginL, footerY - 4, marginL + contentW, footerY - 4);
    doc.setTextColor(82, 88, 102);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(
      'LASU Campus Broadcast · Directorate of Information & Public Relations · Official Advertisement Report',
      marginL,
      footerY
    );
    doc.setTextColor(11, 37, 69);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    doc.text(`Page ${p} of ${totalPages}`, marginL + contentW, footerY, { align: 'right' });
  }

  const fileDate = nowDate.toISOString().slice(0, 10);
  const filename = `LASU-Ad-Statistics-Report-${fileDate}.pdf`;
  doc.save(filename);
  return filename;
}
