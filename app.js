// 初期化処理
document.addEventListener('DOMContentLoaded', async () => {
  const loadingSpinner = document.getElementById('loading-spinner');
  const errorMessage = document.getElementById('error-message');
  const dashboardContent = document.getElementById('dashboard-content');
  const lastUpdatedEl = document.getElementById('last-updated');

  try {
    // Phase 2: data.json からの非同期取得
    // キャッシュを避けるためのクエリパラメータ付与（GitHub Pages側でのキャッシュ対策など）
    const response = await fetch(`./data.json?t=${new Date().getTime()}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // データの最終更新日時をセット
    if (data.lastUpdated) {
      const dateStr = new Date(data.lastUpdated).toLocaleString('ja-JP', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      });
      lastUpdatedEl.textContent = dateStr;
    }

    // 各UIコンポーネントへのデータバインディング
    updateSummary(data.summary || {});
    drawCharts(data.charts || {});
    renderTable(data.recentAnswers || []);

    // 取得完了後、ローディングを非表示にし、ダッシュボードを表示
    loadingSpinner.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

  } catch (error) {
    console.error('データの取得に失敗しました:', error);
    loadingSpinner.classList.add('hidden');
    errorMessage.classList.remove('hidden');
  }
});

// サマリー更新（事前集計されたデータを使用）
function updateSummary(summary) {
  const totalAnswers = summary.totalAnswers || 0;
  const avgSatisfaction = summary.avgSatisfaction !== undefined ? summary.avgSatisfaction.toFixed(1) : "0.0";
  
  // アニメーション風に表示
  animateValue('total-answers', 0, totalAnswers, 800);
  document.getElementById('avg-satisfaction').textContent = avgSatisfaction;
}

// 数値のカウントアップアニメーション
function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.innerHTML = Math.floor(progress * (end - start) + start);
    if (progress < 1) {
      window.requestAnimationFrame(step);
    } else {
      obj.innerHTML = end;
    }
  };
  window.requestAnimationFrame(step);
}

// チャートの描画（事前集計されたデータを使用）
function drawCharts(charts) {
  const satisfactionCounts = charts.satisfaction || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  // 円グラフ
  const ctxSatisfaction = document.getElementById('satisfaction-chart').getContext('2d');
  new Chart(ctxSatisfaction, {
    type: 'pie',
    data: {
      labels: ['1 (不満)', '2', '3', '4', '5 (満足)'],
      datasets: [{
        data: [
          satisfactionCounts[1] || 0,
          satisfactionCounts[2] || 0,
          satisfactionCounts[3] || 0,
          satisfactionCounts[4] || 0,
          satisfactionCounts[5] || 0
        ],
        backgroundColor: [
          '#ef4444', // red-500
          '#f97316', // orange-500
          '#facc15', // yellow-400
          '#84cc16', // lime-500
          '#22c55e', // green-500
        ],
        borderWidth: 0,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 20, font: { family: "'Inter', sans-serif" } }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              let label = context.label || '';
              if (label) label += ': ';
              if (context.parsed !== null) label += context.parsed + '人';
              return label;
            }
          }
        }
      }
    }
  });

  const ageCounts = charts.age || { "10代": 0, "20代": 0, "30代": 0, "40代": 0, "50代": 0, "60代以上": 0 };

  // 棒グラフ
  const ctxAge = document.getElementById('age-chart').getContext('2d');
  new Chart(ctxAge, {
    type: 'bar',
    data: {
      labels: Object.keys(ageCounts),
      datasets: [{
        label: '回答人数',
        data: Object.values(ageCounts),
        backgroundColor: '#6366f1', // indigo-500
        borderRadius: 4,
        barPercentage: 0.6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { family: "'Inter', sans-serif" } },
          grid: { borderDash: [4, 4] }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Inter', sans-serif" } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: function(context) {
              return context.parsed.y + '人';
            }
          }
        }
      }
    }
  });
}

// テーブルの描画（GASから渡されたサニタイズ済み最新データを使用）
function renderTable(recentRows) {
  const tbody = document.getElementById('data-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!recentRows || recentRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-slate-500">データがありません</td></tr>';
    return;
  }

  recentRows.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors group';
    
    let satisfactionColor = 'bg-slate-100 text-slate-800';
    if (item.satisfaction >= 4) satisfactionColor = 'bg-green-100 text-green-800';
    else if (item.satisfaction === 3) satisfactionColor = 'bg-amber-100 text-amber-800';
    else satisfactionColor = 'bg-red-100 text-red-800';

    const interestsIcons = Array.isArray(item.interests) 
      ? item.interests.map(i => `<span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-100">${i}</span>`).join('')
      : '';

    tr.innerHTML = `
      <td class="px-6 py-4 text-sm text-slate-500 font-mono">#${String(item.id).padStart(3, '0')}</td>
      <td class="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">${item.date || ''}</td>
      <td class="px-6 py-4 text-sm text-slate-700">${item.age || ''}</td>
      <td class="px-6 py-4 text-sm text-slate-700">
        <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${satisfactionColor}">
          ★ ${item.satisfaction || '-'}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-slate-700">
        <div class="flex flex-wrap gap-1">${interestsIcons}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}
