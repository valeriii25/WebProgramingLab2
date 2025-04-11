import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
} from 'chart.js';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
);

const currencyListUrl = 'https://api.frankfurter.dev/v1/currencies';
const historicalDataBaseUrl = 'https://api.frankfurter.dev/v1/';

const fromSelect = document.querySelector('.from-currency');
const toSelect = document.querySelector('.to-currency');
const amountInput = document.querySelector('.amount-input');
const form = document.querySelector('.form');
const output = document.querySelector('.conversion-output');
const toggleTheme = document.querySelector('.toggle-theme');
const body = document.body;
const ratesTable = document.querySelector('.rates-table');
const reverseForm = document.querySelector('.reverse-form');
const reverseInput = document.querySelector('.reverse-amount');
const reverseResult = document.querySelector('.reverse-result');
const quoteEl = document.querySelector('.quote');
const chartCanvas = document.querySelector('.trend-chart');
const chartTitleElement = document.querySelector('.historical-chart h2');

let historicalChartInstance = null;

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const loadCurrencies = async () => {
  try {
    const res = await fetch(currencyListUrl);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const currencies = await res.json();

    const options = Object.entries(currencies)
      .map(([code, name]) => `<option value="${code}">${code} — ${name}</option>`)
      .join('');

    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;
    fromSelect.value = 'EUR';
    toSelect.value = 'USD';
    await loadPopularRates();
    await loadChart(fromSelect.value, toSelect.value);
    randomQuote();
  } catch (err) {
    console.error("Failed to load currencies:", err);
    output.textContent = 'Failed to load currencies.';
  }
};

const convertCurrency = async (from, to, amount) => {
  if (isNaN(amount) || amount <= 0) {
    output.textContent = 'Please enter a valid positive amount.';
    return;
  }
  if (from === to) {
    output.textContent = 'Please select different currencies.';
    return;
  }
  try {
    const convertUrl = `https://api.frankfurter.dev/v1/latest?amount=${amount}&from=${from}&to=${to}`;
    const res = await fetch(convertUrl);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const data = await res.json();
    const converted = data.rates[to];

    const formattedAmount = new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
    const formattedConverted = new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(converted);

    output.textContent = `${formattedAmount} ${from} = ${formattedConverted} ${to}`;
    updateReverseHint(from, to, converted / amount);
  } catch (err) {
    console.error("Conversion error:", err);
    if (err.message.includes('404')) {
      output.textContent = `Could not find rates for ${from} to ${to}.`;
    } else {
      output.textContent = 'Conversion error. Check connection or try later.';
    }
  }
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const from = fromSelect.value;
  const to = toSelect.value;
  const amount = parseFloat(amountInput.value);
  await convertCurrency(from, to, amount);
  await loadChart(from, to);
});

toggleTheme.addEventListener('click', () => {
  const isDark = body.classList.contains('dark-theme');
  body.classList.toggle('dark-theme');
  toggleTheme.textContent = isDark ? '☀️' : '🌙';
  if (historicalChartInstance) {
    const textColor = !isDark ? "#f0f0f0" : "#121212";
    const gridColor = !isDark ? "rgba(240,240,240,0.1)" : "rgba(18,18,18,0.1)";
    historicalChartInstance.options.scales.x.ticks.color = textColor;
    historicalChartInstance.options.scales.y.ticks.color = textColor;
    historicalChartInstance.options.scales.x.grid.color = gridColor;
    historicalChartInstance.options.scales.y.grid.color = gridColor;
    historicalChartInstance.options.plugins.legend.labels.color = textColor;
    historicalChartInstance.update();
  }
});

const popularPairs = [
  ['EUR', 'USD'],
  ['USD', 'JPY'],
  ['GBP', 'EUR'],
  ['USD', 'CAD'],
];

const loadPopularRates = async () => {
  ratesTable.innerHTML = 'Loading popular rates...';
  const ratePromises = popularPairs.map(async ([from, to]) => {
    try {
      const res = await fetch(`https://api.frankfurter.dev/v1/latest?from=${from}&to=${to}`);
      if (!res.ok) throw new Error(`Failed for ${from}/${to}`);
      const data = await res.json();
      const rate = data.rates[to];
      return `<div>${from}/${to} = ${rate.toFixed(4)}</div>`;
    } catch (error) {
      console.error(`Failed to load popular rate for ${from}/${to}:`, error);
      return `<div>${from}/${to} = Error</div>`;
    }
  });

  const results = await Promise.all(ratePromises);
  ratesTable.innerHTML = results.join('');
};

const loadChart = async (baseCurrency, targetCurrency) => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - 6);

  const formattedStartDate = formatDate(startDate);
  const formattedEndDate = formatDate(endDate);

  const apiUrl = `${historicalDataBaseUrl}${formattedStartDate}..${formattedEndDate}?from=${baseCurrency}&to=${targetCurrency}`;
  const chartLabel = `${baseCurrency} → ${targetCurrency}`;
  const chartTitle = `${baseCurrency} to ${targetCurrency} - 7 Day Trend`;

  chartTitleElement.textContent = chartTitle;

  try {
    const res = await fetch(apiUrl);
    if (!res.ok) {
      if (res.status === 422 || res.status === 404) {
        throw new Error(`Historical data unavailable for ${baseCurrency}/${targetCurrency}.`);
      }
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();

    if (!data.rates || Object.keys(data.rates).length === 0) {
      throw new Error(`No historical rates found for ${baseCurrency}/${targetCurrency} in the selected period.`);
    }

    const labels = Object.keys(data.rates).sort();
    const values = labels.map(date => data.rates[date][targetCurrency]);

    const chartData = {
      labels,
      datasets: [{
        label: chartLabel,
        data: values,
        borderColor: body.classList.contains('dark-theme') ? '#818cf8' : '#4f46e5',
        backgroundColor: body.classList.contains('dark-theme') ? 'rgba(129, 140, 248, 0.2)' : 'rgba(79, 70, 229, 0.2)',
        fill: true,
        tension: 0.3,
        pointBackgroundColor: body.classList.contains('dark-theme') ? '#818cf8' : '#4f46e5',
        pointRadius: 3,
        pointHoverRadius: 6,
      }],
    };

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            color: body.classList.contains('dark-theme') ? '#f0f0f0' : '#1a1a1a',
          },
          grid: {
            color: body.classList.contains('dark-theme') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }
        },
        x: {
          ticks: {
            color: body.classList.contains('dark-theme') ? '#f0f0f0' : '#1a1a1a',
          },
          grid: {
            color: body.classList.contains('dark-theme') ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: body.classList.contains('dark-theme') ? '#f0f0f0' : '#1a1a1a',
          }
        },
        tooltip: {
          backgroundColor: body.classList.contains('dark-theme') ? '#333' : '#fff',
          titleColor: body.classList.contains('dark-theme') ? '#f0f0f0' : '#1a1a1a',
          bodyColor: body.classList.contains('dark-theme') ? '#f0f0f0' : '#1a1a1a',
          borderColor: body.classList.contains('dark-theme') ? '#555' : '#ccc',
          borderWidth: 1,
        },
      }
    };

    if (historicalChartInstance) {
      historicalChartInstance.data = chartData;
      historicalChartInstance.options = chartOptions;
      historicalChartInstance.update();
    } else {
      historicalChartInstance = new Chart(chartCanvas, {
        type: 'line',
        data: chartData,
        options: chartOptions,
      });
    }
  } catch (err) {
    console.error("Failed to load or update chart:", err);
    chartTitleElement.textContent = `Chart error for ${baseCurrency}/${targetCurrency}`;
    if (historicalChartInstance) {
      historicalChartInstance.destroy();
      historicalChartInstance = null;
    }
    const ctx = chartCanvas.getContext('2d');
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    ctx.save();
    ctx.fillStyle = body.classList.contains('dark-theme') ? '#aaa' : '#555';
    ctx.textAlign = 'center';
    ctx.font = '14px Segoe UI';
    ctx.fillText(err.message || 'Could not load chart data.', chartCanvas.width / 2, chartCanvas.height / 2);
    ctx.restore();
  }
};

let lastRateForReverse = null;

const updateReverseHint = (from, to, rate) => {
  if (rate && !isNaN(rate)) {
    lastRateForReverse = rate;
    reverseInput.placeholder = `I want to receive... ${to}`;
    reverseResult.textContent = 'Enter amount above.';
    reverseInput.value = '';
  } else {
    lastRateForReverse = null;
    reverseInput.placeholder = `Select currencies first`;
    reverseResult.textContent = `Rate unavailable.`;
  }
};

reverseInput.addEventListener('input', () => {
  const targetAmount = parseFloat(reverseInput.value);

  if (isNaN(targetAmount) || targetAmount <= 0) {
    reverseResult.textContent = 'Enter a valid amount.';
    return;
  }

  if (lastRateForReverse) {
    const neededAmount = targetAmount / lastRateForReverse;
    const fromCurrency = fromSelect.value;
    const formattedNeeded = new Intl.NumberFormat(undefined, { style: 'decimal', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(neededAmount);
    reverseResult.textContent = `You'll need ≈ ${formattedNeeded} ${fromCurrency}`;
  } else {
    reverseResult.textContent = 'Convert currencies first to get rate.';
  }
});

reverseForm.addEventListener('submit', (e) => e.preventDefault());

const quotes = [
  "“An investment in knowledge pays the best interest.” – Benjamin Franklin",
  "“Price is what you pay. Value is what you get.” – Warren Buffett",
  "“It’s not your salary that makes you rich, it’s your spending habits.” – Charles A. Jaffe",
  "“Do not save what is left after spending, but spend what is left after saving.” – Warren Buffett",
  "“Money is only a tool. It will take you wherever you wish, but it will not replace you as the driver.” – Ayn Rand"
];

const randomQuote = () => {
  quoteEl.classList.add('fade-out'); 
  setTimeout(() => {
    const idx = Math.floor(Math.random() * quotes.length);
    quoteEl.textContent = quotes[idx]; 
    quoteEl.classList.remove('fade-out'); 
  }, 1000); 
};

loadCurrencies();
setInterval(randomQuote, 10000); 

fromSelect.addEventListener('change', () => {
  updateReverseHint(null, null, null);
  reverseResult.textContent = `Convert to update rate.`;
});
toSelect.addEventListener('change', () => {
  updateReverseHint(null, null, null);
  reverseResult.textContent = `Convert to update rate.`;
});
