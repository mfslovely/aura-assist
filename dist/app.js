const messages = document.querySelector('#messages');
const quickReplies = document.querySelector('#quickReplies');
const form = document.querySelector('#chatForm');
const input = document.querySelector('#messageInput');
const restartButton = document.querySelector('#restartButton');
const micButton = document.querySelector('#micButton');
const soundToggle = document.querySelector('#soundToggle');
const voiceSupport = document.querySelector('#voiceSupport');
const toast = document.querySelector('#toast');

const initialData = () => ({ purpose: '', purposeDetail: '', name: '', phone: '', email: '', followUp: '', date: '', time: '' });
let state = { step: 'purpose', data: initialData(), attempts: 0, speaking: false, transcript: [] };

const flows = {
  sales: { label: 'Product or service enquiry', question: 'Great — which product or service are you interested in, and what would you like to know?', placeholder: 'e.g. I need an AI assistant for my clinic…' },
  support: { label: 'Technical support', question: 'I can help route this correctly. What issue are you experiencing, and how urgent is it?', placeholder: 'Describe the issue and its urgency…' },
  appointment: { label: 'Book a consultation', question: 'Absolutely. What would you like to discuss during the consultation?', placeholder: 'Tell me what you would like to discuss…' },
  other: { label: 'General enquiry', question: 'Of course. Could you briefly tell me what your enquiry is about?', placeholder: 'Describe your enquiry…' }
};

const escapeHTML = (value) => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const titleCase = (value) => value.replace(/\b\w/g, c => c.toUpperCase());
const dateLabel = (date) => new Intl.DateTimeFormat('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' }).format(new Date(`${date}T12:00:00`));

function addMessage(text, sender = 'bot', options = {}) {
  const row = document.createElement('div');
  row.className = `message-row ${sender}${options.className ? ` ${options.className}` : ''}`;
  if (sender === 'bot') row.innerHTML = `<div class="mini-avatar">A</div><div class="bubble">${options.html ? text : escapeHTML(text)}</div>`;
  else row.innerHTML = `<div class="bubble">${escapeHTML(text)}</div>`;
  messages.appendChild(row);
  messages.scrollTop = messages.scrollHeight;
  if (!options.skipTranscript) state.transcript.push({ sender: sender === 'bot' ? 'Aura' : 'Customer', text: options.transcriptText || text.replace(/<[^>]+>/g, ' ') });
  if (sender === 'bot' && state.speaking && !options.html && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    speechSynthesis.speak(utterance);
  }
}

function botReply(text, options = {}) {
  quickReplies.innerHTML = '';
  input.disabled = true;
  const typing = document.createElement('div');
  typing.className = 'message-row bot typing';
  typing.innerHTML = '<div class="mini-avatar">A</div><div class="bubble"><i></i><i></i><i></i></div>';
  messages.appendChild(typing);
  messages.scrollTop = messages.scrollHeight;
  window.setTimeout(() => {
    typing.remove();
    addMessage(text, 'bot', options);
    input.disabled = false;
    input.focus();
    if (options.replies) setReplies(options.replies);
    if (options.placeholder) input.placeholder = options.placeholder;
  }, options.delay || 520);
}

function setReplies(replies) {
  quickReplies.innerHTML = '';
  replies.forEach(reply => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = reply.label;
    button.addEventListener('click', () => handleInput(reply.value || reply.label));
    quickReplies.appendChild(button);
  });
}

function setProgress(stage, percent) {
  document.querySelector('#progressBar').style.width = `${percent}%`;
  document.querySelector('#progressLabel').textContent = `${percent}%`;
  const order = ['enquiry', 'details', 'appointment', 'confirmed'];
  document.querySelectorAll('#stepList li').forEach(li => {
    li.classList.remove('active', 'done');
    const index = order.indexOf(li.dataset.stage);
    const current = order.indexOf(stage);
    if (index < current) li.classList.add('done');
    if (index === current) li.classList.add('active');
  });
}

function identifyPurpose(raw) {
  const value = raw.toLowerCase();
  if (value === 'appointment' || /book|appointment|consult|meeting|demo/.test(value)) return 'appointment';
  if (value === 'sales' || /product|service|price|pricing|buy|sales|quote/.test(value)) return 'sales';
  if (value === 'support' || /support|issue|problem|error|not work|technical|urgent/.test(value)) return 'support';
  if (value === 'other' || value.length >= 8) return 'other';
  return '';
}

function validateName(value) { return /^[a-zA-Z][a-zA-Z .'-]{1,49}$/.test(value.trim()); }
function validatePhone(value) { return value.replace(/\D/g, '').length >= 10 && value.replace(/\D/g, '').length <= 15; }
function validateEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()); }
function validateDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const picked = new Date(`${value}T23:59:59`);
  const today = new Date(); today.setHours(0,0,0,0);
  return !Number.isNaN(picked.getTime()) && picked >= today;
}
function normaliseTime(value) {
  const v = value.trim().toLowerCase().replace('.', ':');
  const match = v.match(/\b(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*(am|pm)\b/);
  if (match) return `${match[1]}:${match[2] || '00'} ${match[3].toUpperCase()}`;
  const twentyFour = v.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    return `${hour % 12 || 12}:${twentyFour[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
  }
  return '';
}

function invalid(message, replies) {
  state.attempts += 1;
  const prefix = state.attempts > 1 ? 'No problem — ' : '';
  botReply(prefix + message, replies ? { replies } : {});
}

function handleInput(raw) {
  const value = raw.trim();
  if (!value || input.disabled) return;
  addMessage(value, 'user');
  input.value = '';
  quickReplies.innerHTML = '';
  state.attempts = 0;

  switch (state.step) {
    case 'purpose': {
      const purpose = identifyPurpose(value);
      if (!purpose) return invalid('I’m not quite sure which team you need. Please choose an option below, or describe your enquiry in a little more detail.', purposeReplies());
      state.data.purpose = purpose;
      state.data.purposeDetail = purpose === 'other' && !['other', 'general enquiry'].includes(value.toLowerCase()) ? value : '';
      state.step = state.data.purposeDetail ? 'name' : 'purposeDetail';
      setProgress('enquiry', 18);
      if (state.step === 'name') return askName();
      botReply(flows[purpose].question, { placeholder: flows[purpose].placeholder });
      break;
    }
    case 'purposeDetail':
      if (value.length < 6) return invalid('Could you add a little more detail so I can route your enquiry correctly?');
      state.data.purposeDetail = value;
      state.step = 'name';
      askName();
      break;
    case 'name':
      if (!validateName(value)) return invalid('Please enter your name using letters, for example “Lovely Gupta”.');
      state.data.name = titleCase(value.trim());
      state.step = 'phone';
      setProgress('details', 34);
      botReply(`Nice to meet you, ${state.data.name.split(' ')[0]}. What’s the best contact number to reach you on?`, { placeholder: 'e.g. +91 98765 43210' });
      break;
    case 'phone':
      if (!validatePhone(value)) return invalid('That number looks incomplete. Please enter 10–15 digits, including the country code if applicable.');
      state.data.phone = value;
      state.step = 'email';
      setProgress('details', 48);
      botReply('Thanks. And what email address should we send the appointment confirmation to?', { placeholder: 'name@example.com' });
      break;
    case 'email':
      if (!validateEmail(value)) return invalid('That email doesn’t look quite right. Please check it and enter an address like name@example.com.');
      state.data.email = value.toLowerCase();
      state.step = 'followUp';
      setProgress('details', 58);
      askFollowUp();
      break;
    case 'followUp':
      if (value.length < 2) return invalid('Please choose one of the options or give me a short answer.');
      state.data.followUp = value;
      state.step = 'date';
      setProgress('appointment', 68);
      botReply('Perfect. What date would suit you? Please use YYYY-MM-DD.', { placeholder: 'YYYY-MM-DD', replies: dateReplies() });
      break;
    case 'date':
      if (!validateDate(value)) return invalid('Please choose today or a future date in YYYY-MM-DD format, such as 2026-11-18.', dateReplies());
      state.data.date = value;
      state.step = 'time';
      setProgress('appointment', 82);
      botReply(`${dateLabel(value)} works. What time would you prefer?`, { placeholder: 'e.g. 11:00 AM', replies: timeReplies() });
      break;
    case 'time': {
      const time = normaliseTime(value);
      if (!time) return invalid('Please enter a valid time, for example 10:30 AM or 14:30.', timeReplies());
      state.data.time = time;
      state.step = 'confirm';
      showConfirmation();
      break;
    }
    case 'confirm':
      if (/yes|confirm|correct|book|looks good/.test(value.toLowerCase())) finalize();
      else if (/no|edit|change|wrong/.test(value.toLowerCase())) editDetails();
      else invalid('Please choose “Confirm appointment” or “Edit details” below.', confirmReplies());
      break;
    case 'complete':
      if (/new|start|another/.test(value.toLowerCase())) startConversation();
      else botReply('Your appointment request is already confirmed. You can add it to your calendar, download the transcript, or start over.');
      break;
  }
}

function purposeReplies() {
  return [
    { label: 'Book a consultation', value: 'appointment' },
    { label: 'Product enquiry', value: 'sales' },
    { label: 'Technical support', value: 'support' },
    { label: 'Something else', value: 'other' }
  ];
}
function dateReplies() {
  return [1, 2, 3].map(days => {
    const d = new Date(); d.setDate(d.getDate() + days);
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return { label: new Intl.DateTimeFormat('en-IN', { weekday:'short', day:'numeric', month:'short' }).format(d), value: iso };
  });
}
function timeReplies() { return ['10:00 AM', '12:30 PM', '3:00 PM', '5:30 PM'].map(label => ({ label })); }
function confirmReplies() { return [{ label: 'Confirm appointment', value: 'confirm' }, { label: 'Edit details', value: 'edit' }]; }

function askName() {
  setProgress('details', 25);
  botReply('Thanks — I have enough context to help. May I have your full name?', { placeholder: 'Your full name' });
}

function askFollowUp() {
  const purpose = state.data.purpose;
  if (purpose === 'support') botReply('Before we schedule, is this blocking your work right now?', { replies: [{label:'Yes, completely'}, {label:'Partially'}, {label:'No, it can wait'}], placeholder: 'Choose an option or type your answer…' });
  else if (purpose === 'sales') botReply('What best describes where you are in your decision?', { replies: [{label:'Just exploring'}, {label:'Comparing options'}, {label:'Ready to get started'}], placeholder: 'Choose an option or type your answer…' });
  else if (purpose === 'appointment') botReply('Would you prefer the appointment online or in person?', { replies: [{label:'Online video call'}, {label:'In person'}, {label:'Either works'}], placeholder: 'Choose your preference…' });
  else botReply('Which team would be the best fit for this conversation?', { replies: [{label:'Sales'}, {label:'Customer success'}, {label:'Operations'}, {label:'Not sure'}], placeholder: 'Choose a team or type your answer…' });
}

function confirmationHTML(final = false) {
  const d = state.data;
  return `<div class="confirmation-title"><span class="check">✓</span>${final ? 'Appointment request confirmed' : 'Please review your details'}</div>
    <div class="summary-grid">
      <div class="summary-item"><small>Name</small><b>${escapeHTML(d.name)}</b></div>
      <div class="summary-item"><small>Contact</small><b>${escapeHTML(d.phone)}</b></div>
      <div class="summary-item wide"><small>Email</small><b>${escapeHTML(d.email)}</b></div>
      <div class="summary-item wide"><small>Enquiry</small><b>${escapeHTML(flows[d.purpose].label)} — ${escapeHTML(d.purposeDetail)}</b></div>
      <div class="summary-item"><small>Date</small><b>${escapeHTML(dateLabel(d.date))}</b></div>
      <div class="summary-item"><small>Time</small><b>${escapeHTML(d.time)}</b></div>
    </div>${final ? '<div class="summary-actions"><button type="button" data-action="calendar">Add to calendar</button><button type="button" data-action="transcript">Download transcript</button></div>' : ''}`;
}

function showConfirmation() {
  setProgress('confirmed', 94);
  botReply(confirmationHTML(false), { html: true, className: 'confirmation', transcriptText: 'Please review the collected details and confirm your appointment.' });
  window.setTimeout(() => setReplies(confirmReplies()), 650);
}

function finalize() {
  quickReplies.innerHTML = '';
  state.step = 'complete';
  setProgress('confirmed', 100);
  botReply(confirmationHTML(true), { html: true, className: 'confirmation', transcriptText: 'Appointment request confirmed. A confirmation will be sent by email.' });
  window.setTimeout(() => botReply(`You’re all set, ${state.data.name.split(' ')[0]}. A confirmation will be sent to ${state.data.email}. We look forward to speaking with you!`, { placeholder: 'Type “start over” for another enquiry' }), 720);
}

function editDetails() {
  state.step = 'purpose';
  state.data = initialData();
  setProgress('enquiry', 5);
  botReply('No problem — let’s update the information. What can we help you with?', { replies: purposeReplies(), placeholder: 'Describe what you need…' });
}

function startConversation() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  state = { step: 'purpose', data: initialData(), attempts: 0, speaking: state.speaking, transcript: [] };
  messages.innerHTML = '';
  quickReplies.innerHTML = '';
  setProgress('enquiry', 5);
  input.placeholder = 'Type your reply…';
  window.setTimeout(() => {
    addMessage('Hi! I’m Aura, your AI customer concierge. I can answer an enquiry and help arrange an appointment — it only takes a minute.', 'bot');
    window.setTimeout(() => botReply('What can we help you with today?', { replies: purposeReplies(), placeholder: 'Describe what you need…' }), 380);
  }, 160);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function downloadTranscript() {
  const content = ['AURA ASSIST — CONVERSATION TRANSCRIPT', `Generated: ${new Date().toLocaleString('en-IN')}`, '', ...state.transcript.map(item => `${item.sender}: ${item.text.replace(/\s+/g, ' ').trim()}`)].join('\n');
  const blob = new Blob([content], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'aura-assist-transcript.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Transcript downloaded');
}

function addToCalendar() {
  const { date, time, purposeDetail, name, email, phone } = state.data;
  const [, hourRaw, minuteRaw, meridiem] = time.match(/(\d+):(\d+)\s(AM|PM)/);
  let hour = Number(hourRaw) % 12 + (meridiem === 'PM' ? 12 : 0);
  const start = new Date(`${date}T${String(hour).padStart(2,'0')}:${minuteRaw}:00`);
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const stamp = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const clean = text => text.replace(/[\\,;]/g, m => `\\${m}`).replace(/\n/g, '\\n');
  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Aura Assist//Appointment//EN\r\nBEGIN:VEVENT\r\nUID:${Date.now()}@aura-assist\r\nDTSTAMP:${stamp(new Date())}\r\nDTSTART:${stamp(start)}\r\nDTEND:${stamp(end)}\r\nSUMMARY:Aura Assist consultation\r\nDESCRIPTION:${clean(`${purposeDetail}\nCustomer: ${name}\nEmail: ${email}\nPhone: ${phone}`)}\r\nSTATUS:TENTATIVE\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'aura-assist-appointment.ics';
  link.click();
  URL.revokeObjectURL(link.href);
  showToast('Calendar invite downloaded');
}

form.addEventListener('submit', event => { event.preventDefault(); handleInput(input.value); });
restartButton.addEventListener('click', startConversation);
messages.addEventListener('click', event => {
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'calendar') addToCalendar();
  if (action === 'transcript') downloadTranscript();
});
soundToggle.addEventListener('click', () => {
  state.speaking = !state.speaking;
  soundToggle.classList.toggle('active', state.speaking);
  soundToggle.setAttribute('aria-label', state.speaking ? 'Turn spoken responses off' : 'Turn spoken responses on');
  if (!state.speaking && 'speechSynthesis' in window) speechSynthesis.cancel();
  showToast(state.speaking ? 'Spoken responses on' : 'Spoken responses off');
});

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-IN';
  recognition.interimResults = false;
  recognition.addEventListener('start', () => { micButton.classList.add('listening'); voiceSupport.textContent = 'Listening…'; });
  recognition.addEventListener('end', () => { micButton.classList.remove('listening'); voiceSupport.textContent = 'Voice input ready'; });
  recognition.addEventListener('result', event => { input.value = event.results[0][0].transcript; input.focus(); });
  recognition.addEventListener('error', () => showToast('Voice input was unavailable — please type your reply'));
  micButton.addEventListener('click', () => { try { recognition.start(); } catch (_) { recognition.stop(); } });
} else {
  micButton.disabled = true;
  micButton.style.opacity = '.35';
  voiceSupport.textContent = 'Voice input not supported';
}

startConversation();
