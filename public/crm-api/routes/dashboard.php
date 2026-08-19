<?php
/**
 * Сводка по сделкам за период.
 *
 * Считаем в PHP, а не запросами с агрегатами: формула суммы сделки одна
 * (crm_deal_totals) и должна оставаться одной. Дублировать её в SQL — верный
 * способ получить в отчёте не те деньги, что в карточке.
 */

declare(strict_types=1);

function crm_route_dashboard(string $method, array $path): void
{
    if ($method !== 'GET') {
        crm_fail(404, 'not_found', 'Неизвестный метод сводки');
    }
    crm_require_user();

    $period = (string) ($_GET['period'] ?? 'month');
    $since = crm_period_start($period);

    $rows = crm_all(
        'SELECT d.*, u.name AS manager_name FROM crm_deals d
         LEFT JOIN crm_users u ON u.id = d.manager_id',
    );

    $inPeriod = array_values(array_filter(
        $rows,
        fn($row) => $since === null || (string) $row['created_at'] >= $since,
    ));

    $byStage = array_fill_keys(CRM_STAGES, 0);
    $byManager = [];

    $revenue = 0.0;   // выручка по завершённым сделкам
    $profit = 0.0;    // наша комиссия по завершённым
    $expected = 0.0;  // остаток к доплате по сделкам в работе
    $won = 0;
    $lost = 0;
    $daysSum = 0;
    $daysCount = 0;

    foreach ($inPeriod as $row) {
        $stage = (string) $row['stage'];
        $byStage[$stage] = ($byStage[$stage] ?? 0) + 1;

        $totals = crm_deal_totals($row);
        $managerId = (string) $row['manager_id'];

        if (!isset($byManager[$managerId])) {
            $byManager[$managerId] = [
                'managerId' => $managerId,
                'managerName' => $row['manager_name'],
                'deals' => 0,
                'won' => 0,
                'revenue' => 0.0,
                'profit' => 0.0,
            ];
        }
        $byManager[$managerId]['deals']++;

        if ($stage === 'DONE') {
            $won++;
            $revenue += $totals['totalRub'];
            $profit += $totals['profitRub'];
            $byManager[$managerId]['won']++;
            $byManager[$managerId]['revenue'] += $totals['totalRub'];
            $byManager[$managerId]['profit'] += $totals['profitRub'];

            // Срок сделки считаем только по завершённым: у остальных он ещё не наступил.
            $closed = $row['closed_at'] ?? null;
            if ($closed !== null && $closed !== '') {
                $days = (strtotime((string) $closed) - strtotime((string) $row['created_at'])) / 86400;
                if ($days >= 0) {
                    $daysSum += $days;
                    $daysCount++;
                }
            }
        } elseif ($stage === 'LOST') {
            $lost++;
        } else {
            $expected += max(0.0, $totals['dueRub']);
        }
    }

    $closedTotal = $won + $lost;

    foreach ($byManager as $key => $stats) {
        $byManager[$key]['revenue'] = crm_round2($stats['revenue']);
        $byManager[$key]['profit'] = crm_round2($stats['profit']);
    }

    crm_json([
        'ok' => true,
        'period' => $period,
        'stats' => [
            'deals' => count($inPeriod),
            'won' => $won,
            'lost' => $lost,
            'revenue' => crm_round2($revenue),
            'profit' => crm_round2($profit),
            'expected' => crm_round2($expected),
            'averageCheck' => $won > 0 ? crm_round2($revenue / $won) : 0,
            // Конверсия считается от закрытых сделок: сделки в работе ещё
            // ничем не закончились и знаменатель бы искажали.
            'conversion' => $closedTotal > 0 ? round($won / $closedTotal * 100, 1) : 0,
            'averageDays' => $daysCount > 0 ? round($daysSum / $daysCount) : 0,
        ],
        'byStage' => $byStage,
        'byManager' => array_values($byManager),
    ]);
}

/** Начало периода в том же формате, в котором лежат даты создания. */
function crm_period_start(string $period): ?string
{
    return match ($period) {
        'month' => gmdate('Y-m-d\TH:i:s\Z', strtotime('-30 days')),
        'quarter' => gmdate('Y-m-d\TH:i:s\Z', strtotime('-90 days')),
        'year' => gmdate('Y-m-d\TH:i:s\Z', strtotime('-365 days')),
        default => null,
    };
}
