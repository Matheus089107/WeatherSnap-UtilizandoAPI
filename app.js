/**
 * WeatherSnap - App de Previsão do Tempo
 * Consome API Open-Meteo (geocoding + forecast)
 */

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// Mapeamento dos códigos WMO (Open-Meteo) para descrição em PT-BR
const WEATHER_CODES = {
  0: { desc: 'Céu limpo', type: 'clear' },
  1: { desc: 'Principalmente limpo', type: 'clear' },
  2: { desc: 'Parcialmente nublado', type: 'cloudy' },
  3: { desc: 'Nublado', type: 'cloudy' },
  45: { desc: 'Neblina', type: 'foggy' },
  48: { desc: 'Neblina com geada', type: 'foggy' },
  51: { desc: 'Garoa leve', type: 'rainy' },
  53: { desc: 'Garoa moderada', type: 'rainy' },
  55: { desc: 'Garoa densa', type: 'rainy' },
  61: { desc: 'Chuva fraca', type: 'rainy' },
  63: { desc: 'Chuva moderada', type: 'rainy' },
  65: { desc: 'Chuva forte', type: 'rainy' },
  66: { desc: 'Chuva congelante fraca', type: 'rainy' },
  67: { desc: 'Chuva congelante forte', type: 'rainy' },
  71: { desc: 'Queda de neve fraca', type: 'snowy' },
  73: { desc: 'Queda de neve moderada', type: 'snowy' },
  75: { desc: 'Queda de neve forte', type: 'snowy' },
  77: { desc: 'Grãos de neve', type: 'snowy' },
  80: { desc: 'Pancadas de chuva leves', type: 'rainy' },
  81: { desc: 'Pancadas de chuva moderadas', type: 'rainy' },
  82: { desc: 'Pancadas de chuva violentas', type: 'rainy' },
  85: { desc: 'Pancadas de neve leves', type: 'snowy' },
  86: { desc: 'Pancadas de neve fortes', type: 'snowy' },
  95: { desc: 'Temporal', type: 'stormy' },
  96: { desc: 'Temporal com granizo leve', type: 'stormy' },
  99: { desc: 'Temporal com granizo forte', type: 'stormy' },
};

// Sugestões inteligentes por tipo de clima e temperatura
const SUGGESTIONS = {
  rainy: [
    { text: 'Leve um guarda-chuva!', emoji: '☔' },
    { text: 'Dia perfeito para um café quente e um bom livro!', emoji: '☕📚' },
    { text: 'Ideal para assistir um filme em casa.', emoji: '🎬' },
    { text: 'Que tal um chocolate quente?', emoji: '🍫' },
  ],
  snowy: [
    { text: 'Abrigue-se bem ao sair!', emoji: '🧣' },
    { text: 'Ótimo dia para ficar em casa no calor.', emoji: '🔥' },
  ],
  stormy: [
    { text: 'Evite sair; prefira ficar em local seguro.', emoji: '🏠' },
    { text: 'Tempo de ficar em casa e descansar.', emoji: '⛈️' },
  ],
  cloudy: [
    { text: 'Tempo agradável para uma caminhada leve.', emoji: '🚶' },
    { text: 'Ideal para atividades ao ar livre sem sol forte.', emoji: '🌤️' },
  ],
  clear: [
    { text: 'Ideal para uma caminhada.', emoji: '🌞' },
    { text: 'Dia perfeito para um piquenique!', emoji: '🧺' },
    { text: 'Tempo ótimo para praticar esportes ao ar livre.', emoji: '⚽' },
  ],
  foggy: [
    { text: 'Dirija com cuidado na neblina.', emoji: '🚗' },
    { text: 'Bom dia para ficar em ambientes fechados.', emoji: '🏠' },
  ],
};
const SUGGESTIONS_COLD = [
  { text: 'Vista-se bem; está frio lá fora!', emoji: '🧥' },
  { text: 'Dia de casaco e bebida quente.', emoji: '☕' },
];
const SUGGESTIONS_HOT = [
  { text: 'Mantenha-se hidratado!', emoji: '💧' },
  { text: 'Evite exposição prolongada ao sol.', emoji: '🧴' },
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

// Estado da aplicação
let compareList = [];

// Elementos DOM
const searchInput = document.getElementById('search-input');
const btnSearch = document.getElementById('btn-search');
const cardCurrent = document.getElementById('card-current');
const stateLoading = document.getElementById('state-loading');
const stateError = document.getElementById('state-error');
const errorMessage = document.getElementById('error-message');
const cityName = document.getElementById('city-name');
const currentDate = document.getElementById('current-date');
const currentTemp = document.getElementById('current-temp');
const currentDesc = document.getElementById('current-desc');
const windSpeed = document.getElementById('wind-speed');
const humidity = document.getElementById('humidity');
const suggestionBox = document.getElementById('suggestion-box');
const suggestionText = document.getElementById('suggestion-text');
const suggestionEmoji = document.getElementById('suggestion-emoji');
const weatherIconWrapper = document.getElementById('weather-icon-wrapper');
const compareBadge = document.getElementById('compare-badge');
const btnShare = document.getElementById('btn-share');

function showLoading(show) {
  stateLoading.classList.toggle('hidden', !show);
  cardCurrent.classList.toggle('opacity-60', show);
}
function showError(show, message = '') {
  stateError.classList.toggle('hidden', !show);
  errorMessage.textContent = message;
}

/** Busca coordenadas pelo nome da cidade (Open-Meteo Geocoding) */
async function geocodeCity(query) {
  const params = new URLSearchParams({ name: query.trim(), count: 1, language: 'pt' });
  const res = await fetch(`${GEOCODING_URL}?${params}`);
  if (!res.ok) throw new Error('Falha ao buscar localização.');
  const data = await res.json();
  if (!data.results || data.results.length === 0) throw new Error('Cidade não encontrada. Tente outro nome.');
  return data.results[0];
}

/** Busca previsão (Open-Meteo Forecast) */
async function fetchForecast(lat, lon, timezone = 'auto') {
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    timezone,
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min',
    forecast_days: 4,
  });
  const res = await fetch(`${FORECAST_URL}?${params}`);
  if (!res.ok) throw new Error('Falha ao buscar previsão.');
  return res.json();
}

function getWeatherInfo(code) {
  return WEATHER_CODES[code] || WEATHER_CODES[0];
}

/** Retorna sugestão inteligente com base em tipo de clima e temperatura */
function getSuggestion(weatherType, temp) {
  const list = SUGGESTIONS[weatherType] || SUGGESTIONS.cloudy;
  let pool = [...list];
  if (temp <= 10) pool = [...SUGGESTIONS_COLD, ...pool];
  else if (temp >= 30) pool = [...SUGGESTIONS_HOT, ...pool];
  const chosen = pool[Math.floor(Math.random() * pool.length)];
  return chosen;
}

/** Aplica tema dinâmico: condição climática + dia/noite (via API) */
function applyTheme(weatherType, isDay) {
  document.body.classList.remove('theme-clear', 'theme-cloudy', 'theme-rainy', 'theme-snowy', 'theme-stormy', 'theme-foggy', 'theme-light');
  document.body.classList.add(`theme-${weatherType}`);
  // Dia = tema claro, noite = tema escuro
  if (isDay) document.body.classList.add('theme-light');
  else document.body.classList.remove('theme-light');
}

/** Gera SVG do ícone climático animado */
function renderWeatherIcon(code, size = 96) {
  const { type } = getWeatherInfo(code);
  const s = size;
  const half = s / 2;

  if (type === 'rainy') {
    return `
      <svg class="weather-icon-rain w-full h-full text-slate-300" viewBox="0 0 ${s} ${s}" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M${half-15} ${half-5} a12 12 0 1 1 24 0 a12 12 0 0 1 -24 0Z" fill="currentColor" opacity="0.3"/>
        <path d="M${half+5} ${half-12} a10 10 0 1 1 20 0 a10 10 0 0 1 -20 0Z" fill="currentColor" opacity="0.4"/>
        <path d="M${half-8} ${half+8} a8 8 0 1 1 16 0 a8 8 0 0 1 -16 0Z" fill="currentColor" opacity="0.5"/>
        <line class="drop" x1="${half-12}" y1="${half+18}" x2="${half-10}" y2="${half+28}" stroke-width="2"/>
        <line class="drop" x1="${half}" y1="${half+20}" x2="${half+2}" y2="${half+30}" stroke-width="2"/>
        <line class="drop" x1="${half+12}" y1="${half+16}" x2="${half+14}" y2="${half+26}" stroke-width="2"/>
      </svg>`;
  }
  if (type === 'snowy') {
    return `
      <svg class="weather-icon-snow w-full h-full text-slate-300" viewBox="0 0 ${s} ${s}" fill="none" stroke="currentColor" stroke-width="1.2">
        <path d="M${half-12} ${half-8} a10 10 0 1 1 24 0 a10 10 0 0 1 -24 0Z" fill="currentColor" opacity="0.4"/>
        <path d="M${half+2} ${half-14} a8 8 0 1 1 16 0 a8 8 0 0 1 -16 0Z" fill="currentColor" opacity="0.5"/>
        <path d="M${half-6} ${half+6} a6 6 0 1 1 12 0 a6 6 0 0 1 -12 0Z" fill="currentColor" opacity="0.6"/>
        <line class="flake" x1="${half}" y1="${half+14}" x2="${half}" y2="${half+22}"/>
        <line class="flake" x1="${half-4}" y1="${half+16}" x2="${half+4}" y2="${half+20}"/>
        <line class="flake" x1="${half+4}" y1="${half+16}" x2="${half-4}" y2="${half+20}"/>
      </svg>`;
  }
  if (type === 'stormy') {
    return `
      <svg class="w-full h-full text-slate-400" viewBox="0 0 ${s} ${s}" fill="currentColor">
        <path d="M${half-14} ${half-6} a14 14 0 1 1 28 0 a14 14 0 0 1 -28 0Z" opacity="0.5"/>
        <path d="M${half+4} ${half-12} a10 10 0 1 1 20 0 a10 10 0 0 1 -20 0Z" opacity="0.6"/>
        <path d="M${half-6} ${half+4} a8 8 0 1 1 16 0 a8 8 0 0 1 -16 0Z" opacity="0.5"/>
        <path fill="amber" d="M${half+2} ${half+12} L${half+12} ${half+24} L${half+6} ${half+24} L${half+14} ${half+38} L${half-2} ${half+22} L${half+4} ${half+22} Z"/>
      </svg>`;
  }
  if (type === 'clear') {
    return `
      <svg class="weather-icon-sun w-full h-full text-amber-400" viewBox="0 0 ${s} ${s}" fill="currentColor">
        <circle class="ray" cx="${half}" cy="${half}" r="${s/6}"/>
        <line class="ray" x1="${half}" y1="8" x2="${half}" y2="4" stroke="currentColor" stroke-width="2"/>
        <line class="ray" x1="${half}" y1="${s-8}" x2="${half}" y2="${s-4}" stroke="currentColor" stroke-width="2"/>
        <line class="ray" x1="8" y1="${half}" x2="4" y2="${half}" stroke="currentColor" stroke-width="2"/>
        <line class="ray" x1="${s-8}" y1="${half}" x2="${s-4}" y2="${half}" stroke="currentColor" stroke-width="2"/>
        <line class="ray" x1="${half-20}" y1="${half-20}" x2="${half-26}" y2="${half-26}" stroke="currentColor" stroke-width="2"/>
        <line class="ray" x1="${half+20}" y1="${half+20}" x2="${half+26}" y2="${half+26}" stroke="currentColor" stroke-width="2"/>
        <line class="ray" x1="${half+20}" y1="${half-20}" x2="${half+26}" y2="${half-26}" stroke="currentColor" stroke-width="2"/>
        <line class="ray" x1="${half-20}" y1="${half+20}" x2="${half-26}" y2="${half+26}" stroke="currentColor" stroke-width="2"/>
      </svg>`;
  }
  // cloudy / foggy
  return `
    <svg class="weather-icon-cloud w-full h-full text-slate-400" viewBox="0 0 ${s} ${s}" fill="currentColor">
      <path d="M${half-18} ${half} a14 14 0 1 1 28 0 a14 14 0 0 1 -28 0Z" opacity="0.5"/>
      <path d="M${half+2} ${half-12} a12 12 0 1 1 24 0 a12 12 0 0 1 -24 0Z" opacity="0.6"/>
      <path d="M${half-8} ${half+8} a10 10 0 1 1 20 0 a10 10 0 0 1 -20 0Z" opacity="0.5"/>
    </svg>`;
}

function formatDate(dateStr, timezone = 'UTC') {
  // Parse em UTC meio-dia para evitar viés de timezone ao interpretar YYYY-MM-DD
  const d = new Date(dateStr + 'T12:00:00Z');
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
}

function renderCurrent(location, data) {
  const cur = data.current;
  const tz = data.timezone || 'UTC';
  const isDay = cur.is_day === 1;

  const code = cur.weather_code;
  const info = getWeatherInfo(code);
  const temp = Math.round(cur.temperature_2m);
  const suggestion = getSuggestion(info.type, temp);

  cityName.textContent = `${location.name}, ${location.country}`;
  currentDate.textContent = formatDate(data.daily.time[0], tz);
  currentTemp.textContent = `${temp}°C`;
  currentDesc.textContent = info.desc;
  windSpeed.textContent = `${cur.wind_speed_10m} km/h`;
  humidity.textContent = `${cur.relative_humidity_2m}%`;
  suggestionEmoji.textContent = suggestion.emoji;
  suggestionText.textContent = suggestion.text;

  weatherIconWrapper.innerHTML = renderWeatherIcon(code, 96);
  applyTheme(info.type, isDay);
}

const WEEKDAY_MAP = { 'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sáb': 6 };

function renderDaily(data) {
  const daily = data.daily;
  const tz = data.timezone || 'UTC';
  // Próximos 3 dias (índices 1, 2, 3; 0 é hoje)
  for (let i = 1; i <= 3; i++) {
    const idx = i;
    const dateStr = daily.time[idx];
    const d = new Date(dateStr + 'T12:00:00Z');
    const weekDay = new Intl.DateTimeFormat('pt-BR', { timeZone: tz, weekday: 'short' }).format(d).toLowerCase().replace('.', '');
    const dayIndex = WEEKDAY_MAP[weekDay] ?? d.getDay();
    const dayNameEl = document.getElementById(`day${i}-name`);
    const dayDescEl = document.getElementById(`day${i}-desc`);
    const dayTempEl = document.getElementById(`day${i}-temp`);
    const dayIconEl = document.getElementById(`day${i}-icon`);

    const code = daily.weather_code[idx];
    const info = getWeatherInfo(code);
    const maxTemp = daily.temperature_2m_max[idx];

    dayNameEl.textContent = DAY_NAMES[dayIndex] + '.';
    dayDescEl.textContent = info.desc;
    dayTempEl.textContent = `${Math.round(maxTemp)}°C`;
    dayIconEl.innerHTML = renderWeatherIcon(code, 50);
  }
}

async function search() {
  const query = searchInput.value.trim();
  if (!query) {
    showError(true, 'Digite o nome de uma cidade.');
    return;
  }
  showError(false);
  showLoading(true);
  try {
    const location = await geocodeCity(query);
    const forecast = await fetchForecast(location.latitude, location.longitude, location.timezone);
    renderCurrent(location, forecast);
    renderDaily(forecast);
    cardCurrent.classList.remove('opacity-60');
  } catch (err) {
    showError(true, err.message || 'Erro ao buscar previsão. Tente novamente.');
  } finally {
    showLoading(false);
  }
}

function setupListeners() {
  btnSearch.addEventListener('click', search);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') search(); });
  btnShare.addEventListener('click', () => {
    if (!navigator.share) {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copiado para a área de transferência!');
      return;
    }
    navigator.share({
      title: 'WeatherSnap',
      text: `${cityName.textContent} - ${currentTemp.textContent}`,
      url: window.location.href,
    }).catch(() => {});
  });
  document.getElementById('btn-compare').addEventListener('click', () => {
    const name = cityName.textContent;
    if (name && name !== '—' && !compareList.includes(name)) {
      compareList.push(name);
      compareBadge.textContent = compareList.length;
      compareBadge.classList.remove('hidden');
    }
  });
}

setupListeners();
