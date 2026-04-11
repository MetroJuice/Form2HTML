let globalData = null;
let radarChartInstance = null;
let barChartInstance = null;

// CSS Animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-fade-in {
    animation: fadeIn 0.5s ease-out forwards;
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', async () => {
  const loadingSpinner = document.getElementById('loading-spinner');
  const errorMessage = document.getElementById('error-message');
  const dashboardContent = document.getElementById('dashboard-content');
  const filterSelect = document.getElementById('generation-filter');

  try {
    // 本番環境: data.json からの非同期取得
    const response = await fetch(`./data.json?t=${new Date().getTime()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    globalData = await response.json();

    // データの最終更新日時をセット
    if (globalData.last_updated) {
      document.getElementById('last-updated').textContent = globalData.last_updated;
    }

    // 初期状態は「全体」
    renderDashboard('overall');

    // ローディングを非表示にし、ダッシュボードを表示
    loadingSpinner.classList.add('hidden');
    dashboardContent.classList.remove('hidden');

    // フィルターの変更イベント
    filterSelect.addEventListener('change', (e) => {
      const selectedGen = e.target.value;
      
      // UIにフェードアウト・イン効果をつける
      dashboardContent.style.opacity = '0.5';
      setTimeout(() => {
        renderDashboard(selectedGen);
        dashboardContent.style.opacity = '1';
      }, 300);
    });

  } catch (error) {
    console.error('データの初期化に失敗しました:', error);
    loadingSpinner.classList.add('hidden');
    errorMessage.classList.remove('hidden');
  }
});

function renderDashboard(generationKey) {
  let dataToRender;
  const isOverall = generationKey === 'overall';

  if (isOverall) {
    dataToRender = globalData.overall;
  } else {
    dataToRender = globalData.by_generation[generationKey] || getEmptyData();
  }

  // KPIカードの更新
  updateKPI(dataToRender);

  // グラフの更新
  updateCharts(dataToRender, generationKey);

  // テーブルの更新
  renderTable(dataToRender.recentAnswers || []);
}

function updateKPI(data) {
  // 1: Total Responses
  animateValue('kpi-total', 0, data.total_responses || 0, 800);
  
  // 2: Top Request
  document.getElementById('kpi-request').textContent = data.top_request || "データなし";
  document.getElementById('kpi-request').title = data.top_request || "";

  // 3: Top Policy
  document.getElementById('kpi-policy').textContent = data.top_policy || "データなし";
  document.getElementById('kpi-policy').title = data.top_policy || "";
}

function updateCharts(data, generationKey) {
  const radarData = data.satisfaction || { 
    "地元商店街の活性化策": 0, "地域独自のイベント": 0, 
    "インフラ整備": 0, "住宅支援": 0, "起業家支援": 0 
  };
  
  // -- Radar Chart --
  if (radarChartInstance) {
    radarChartInstance.data.datasets[0].data = Object.values(radarData);
    radarChartInstance.data.datasets[0].label = generationKey === 'overall' ? '全体の平均重要度' : `${generationKey}の平均重要度`;
    radarChartInstance.update();
  } else {
    const ctxRadar = document.getElementById('satisfaction-chart').getContext('2d');
    radarChartInstance = new Chart(ctxRadar, {
      type: 'radar',
      data: {
        labels: Object.keys(radarData),
        datasets: [{
          label: '平均重要度',
          data: Object.values(radarData),
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: '#6366f1',
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: '#6366f1',
          borderWidth: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            angleLines: { display: true },
            suggestedMin: 1,
            suggestedMax: 5,
            ticks: { stepSize: 1, font: { size: 10 } },
            pointLabels: { font: { size: 11 } }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => ctx.parsed.r + '点' } }
        }
      }
    });
  }

  // -- Bar Chart (Age Distribution) --
  const ageChartContainer = document.getElementById('age-chart-container');
  
  if (generationKey !== 'overall') {
    // 世代絞り込み時は年齢分布グラフを隠す（もしくは1本の棒になるので不要）
    ageChartContainer.style.display = 'none';
  } else {
    ageChartContainer.style.display = 'flex';
    const ageData = data.age_counts || {};

    if (barChartInstance) {
      barChartInstance.data.datasets[0].data = Object.values(ageData);
      barChartInstance.update();
    } else {
      const ctxAge = document.getElementById('age-chart').getContext('2d');
      barChartInstance = new Chart(ctxAge, {
        type: 'bar',
        data: {
          labels: Object.keys(ageData),
          datasets: [{
            label: '回答数',
            data: Object.values(ageData),
            backgroundColor: '#6366f1',
            borderRadius: 6,
            barPercentage: 0.6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } },
            x: { grid: { display: false } }
          },
          plugins: {
            legend: { display: false },
          }
        }
      });
    }
  }
}

function renderTable(rows) {
  const tbody = document.getElementById('data-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (!rows || rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-8 text-center text-sm text-slate-500 bg-slate-50/50">この属性のデータはありません</td></tr>';
    return;
  }

  rows.forEach(item => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition-colors group';

    const interestsIcons = Array.isArray(item.interests) 
      ? item.interests.map(i => `<span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs border border-indigo-100 whitespace-nowrap">${i}</span>`).join('')
      : '';

    tr.innerHTML = `
      <td class="px-6 py-4 text-sm text-slate-500 font-mono">#${String(item.id).padStart(3, '0')}</td>
      <td class="px-6 py-4 text-sm text-slate-700 whitespace-nowrap">${item.date || ''}</td>
      <td class="px-6 py-4 text-sm text-slate-700">${item.age || ''}</td>
      <td class="px-6 py-4 text-sm text-slate-700">
        <span class="px-3 py-1 rounded bg-slate-100 text-slate-800 text-xs font-semibold whitespace-nowrap">
          ${item.mostWanted || '-'}
        </span>
      </td>
      <td class="px-6 py-4 text-sm text-slate-700">
        <div class="flex flex-wrap gap-1">${interestsIcons}</div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

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

function getEmptyData() {
  return {
    total_responses: 0,
    top_request: "-",
    top_policy: "-",
    satisfaction: { "地元商店街の活性化策": 0, "地域独自のイベントや文化活動": 0, "テレワーク促進インフラ整備": 0, "UIターン希望者への住宅支援": 0, "若手起業家への支援制度": 0 },
    recentAnswers: []
  };
}
