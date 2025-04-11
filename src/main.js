import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend
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
const convertUrl = 'https://api.frankfurter.dev/v1/latest';

const fromSelect = document.querySelector('.from-currency');
const toSelect = document.querySelector('.to-currency');
const amountInput = document.querySelector('.amount-input');
const form = document.querySelector('.form');
const output = document.querySelector('.conversion-output');
const toggleTheme = document.querySelector('.toggle-theme');
const body = document.body;

const loadCurrencies = async () => {
  try {
    const res = await fetch(currencyListUrl);
    const currencies = await res.json();

    const options = Object.entries(currencies)
      .map(([code, name]) => `<option value="${code}">${code} — ${name}</option>`)
      .join('');

    fromSelect.innerHTML = options;
    toSelect.innerHTML = options;
    fromSelect.value = 'EUR';
    toSelect.value = 'USD';
  } catch (err) {
    output.textContent = 'Failed to load currencies.';
  }
};

const convertCurrency = async (from, to, amount) => {
  try {
    const res = await fetch(`${convertUrl}?base=${from}&symbols=${to}`);
    const data = await res.json();
    const rate = data.rates[to];
    const converted = (amount * rate).toFixed(2);

    output.textContent = `${amount} ${from} = ${converted} ${to}`;
  } catch (err) {
    output.textContent = 'Conversion error. Try again later.';
  }
};

form.addEventListener('submit', e => {
  e.preventDefault();
  const from = fromSelect.value;
  const to = toSelect.value;
  const amount = parseFloat(amountInput.value);
  if (from === to) {
    output.textContent = 'Please select different currencies.';
    return;
  }
  requestAnimationFrame(() => convertCurrency(from, to, amount));
});

toggleTheme.addEventListener('click', () => {
  body.classList.toggle('dark-theme');
  toggleTheme.textContent = body.classList.contains('dark-theme') ? '☀️' : '🌙';
});

loadCurrencies();

const popularPairs = [
  ['EUR', 'USD'],
  ['USD', 'JPY'],
  ['GBP', 'EUR'],
  ['EUR', 'CHF'],
];

const ratesTable = document.querySelector('.rates-table');
const reverseForm = document.querySelector('.reverse-form');
const reverseInput = document.querySelector('.reverse-amount');
const reverseResult = document.querySelector('.reverse-result');
const quoteEl = document.querySelector('.quote');

const loadPopularRates = async () => {
  ratesTable.innerHTML = '';
  for (const [from, to] of popularPairs) {
    const res = await fetch(`${convertUrl}?base=${from}&symbols=${to}`);
    const data = await res.json();
    const rate = data.rates[to];
    const el = document.createElement('div');
    el.textContent = `${from}/${to} = ${rate.toFixed(2)}`;
    ratesTable.appendChild(el);
  }
};

const loadChart = async () => {
  const res = await fetch('https://api.frankfurter.dev/v1/2025-04-04..2025-04-10?symbols=USD');
  const data = await res.json();
  const labels = Object.keys(data.rates);
  const values = labels.map(date => data.rates[date].USD);

  new Chart(document.querySelector('.trend-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'EUR → USD',
        data: values,
        borderColor: 'blue',
        fill: false,
        tension: 0.3,
      }],
    },
    options: {
      scales: {
        y: { beginAtZero: false },
      },
    }
  });
};

reverseForm.addEventListener('submit', async e => {
  e.preventDefault();
  const target = parseFloat(reverseInput.value);
  if (!target) return;

  const from = fromSelect.value;
  const to = toSelect.value;

  const res = await fetch(`${convertUrl}?base=${from}&symbols=${to}`);
  const data = await res.json();
  const rate = data.rates[to];

  const needed = (target / rate).toFixed(2);
  reverseResult.textContent = `You'll need ${needed} ${from}`;
});

const quotes = [
  "“An investment in knowledge pays the best interest.” – Benjamin Franklin",
  "“Price is what you pay. Value is what you get.” – Warren Buffett",
  "“It’s not your salary that makes you rich, it’s your spending habits.”",
  "“Don’t tell me what you value. Show me your budget.” – Joe Biden"
];

const randomQuote = () => {
  const idx = Math.floor(Math.random() * quotes.length);
  quoteEl.textContent = quotes[idx];
};

loadCurrencies();
loadPopularRates();
loadChart();
randomQuote();