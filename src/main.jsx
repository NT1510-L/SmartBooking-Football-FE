import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert,
  CircleCheck, Clock3, Goal, LogIn, LogOut, MapPin, Plus, RefreshCw, Search, Settings2, Wallet, X
} from 'lucide-react';
import './style.css';

const base = import.meta.env.MODE === 'vercel'
  ? ''
  : (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const utcDate = value => new Date(value.endsWith('Z') ? value : value + 'Z');
const time = value => value ? new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
}).format(utcDate(value)) : '';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const hourText = hour => `${String(hour).padStart(2, '0')}:00`;
const dayText = date => date ? date.split('-').reverse().join('/') : 'Chưa chọn';
const scheduleClock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
const labels = { PendingPayment: 'Chờ thanh toán', Confirmed: 'Đã xác nhận', Completed: 'Hoàn tất', Cancelled: 'Đã hủy', Expired: 'Hết hạn' };

function focusSection(element) {
  element?.focus({ preventScroll: true });
  element?.scrollIntoView({ block: 'start' });
}

function bookingFromUrl() {
  const id = new URLSearchParams(window.location.search).get('booking');
  return /^[1-9]\d{0,18}$/.test(id ?? '') ? id : null;
}

async function request(path, token, method = 'GET', body, signal) {
  const response = await fetch(base + '/api' + path, {
    method,
    headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
    signal
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const failure = new Error(error.message || error.detail || ({
      400: 'Dữ liệu không hợp lệ.', 401: 'Thông tin đăng nhập không đúng hoặc phiên đã hết hạn.',
      403: 'Bạn không có quyền thực hiện thao tác này.', 404: 'Không tìm thấy dữ liệu.'
    })[response.status] || 'Yêu cầu thất bại (' + response.status + ').');
    failure.status = response.status;
    failure.code = error.code;
    failure.amountVnd = error.amountVnd;
    throw failure;
  }
  return response.status === 204 ? null : response.json();
}

function useResult(load, dependencies, { onError, refreshMs = 0 } = {}) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let timer;
    let data;
    async function refresh() {
      try {
        data = await load(signal);
        if (!signal.aborted) setResult({ dependencies, value: { data } });
      } catch (error) {
        if (signal.aborted) return;
        setResult({ dependencies, value: { data, error: error.message } });
        onError?.(error.message);
      } finally {
        if (!signal.aborted && refreshMs > 0) timer = setTimeout(refresh, refreshMs);
      }
    }
    refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [...dependencies, refreshMs]);
  return result && dependencies.every((value, index) => Object.is(value, result.dependencies[index]))
    ? result.value : null;
}

function useData(load, dependencies, onError) {
  const result = useResult(load, dependencies, { onError });
  if (!result) return null;
  return result.error ? [] : result.data;
}

function LoadError({ message, retry }) {
  return <div className="load-error" role="alert"><CircleAlert size={18} aria-hidden="true" />
    <span>{message}</span><button type="button" onClick={retry}>Thử lại</button></div>;
}

function Status({ value }) {
  const Icon = value === 'PendingPayment' ? Clock3 : value === 'Confirmed' || value === 'Completed' ? CircleCheck : CircleAlert;
  return <span className={'status status-' + value}><Icon size={14} aria-hidden="true" />{labels[value] || value}</span>;
}

function App() {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('football-session')); } catch { return null; }
  });
  const [screen, setScreen] = useState('browse');
  const [paymentId, setPaymentId] = useState(bookingFromUrl);
  const [initialPayment, setInitialPayment] = useState(null);
  const [paymentRevision, setPaymentRevision] = useState(0);
  const [error, setError] = useState('');
  const [browseVersion, setBrowseVersion] = useState(0);
  const role = session?.role;
  const activeScreen = paymentId ? (role === 'User' ? 'payment' : 'login') : screen;

  useEffect(() => {
    function restorePayment() {
      setPaymentId(bookingFromUrl());
      setInitialPayment(null);
      setError('');
    }
    window.addEventListener('popstate', restorePayment);
    return () => window.removeEventListener('popstate', restorePayment);
  }, []);

  function setPaymentRoute(id) {
    const url = new URL(window.location.href);
    if (id) {
      url.searchParams.set('booking', id);
      url.hash = '';
    } else url.searchParams.delete('booking');
    if (url.href !== window.location.href) window.history.pushState(null, '', url);
    setPaymentId(id);
  }
  function navigate(next) {
    if (paymentId) setPaymentRoute(null);
    setInitialPayment(null);
    setError('');
    setScreen(next);
    window.scrollTo(0, 0);
  }
  function openPayment(id, detail = null) {
    setError('');
    setInitialPayment(detail);
    setPaymentRoute(String(id));
    window.scrollTo(0, 0);
  }
  function clearSession() {
    setSession(null);
    sessionStorage.removeItem('football-session');
    setBrowseVersion(value => value + 1);
    setInitialPayment(null);
  }
  function authenticate(next) {
    setSession(next);
    sessionStorage.setItem('football-session', JSON.stringify(next));
    if (paymentId) setError('');
    else navigate(next.role === 'User' ? 'browse' : 'manage');
  }
  const call = async (path, method, body, signal) => {
    try { return await request(path, session?.token, method, body, signal); }
    catch (error) {
      if (session && error.status === 401) {
        clearSession();
        if (!bookingFromUrl()) navigate('login');
      }
      throw error;
    }
  };
  const links = [
    ['browse', 'Tìm sân', MapPin],
    ...(role === 'User' ? [['bookings', 'Lịch đặt của tôi', CalendarDays], ['notifications', 'Thông báo', Bell]] : []),
    ...(role === 'Manager' ? [['staffBookings', 'Lịch sân', CalendarDays], ['manage', 'Quản lý chi nhánh', Settings2]] : []),
    ...(role === 'Admin' ? [['staffBookings', 'Lịch toàn hệ thống', CalendarDays], ['manage', 'Quản trị', Settings2], ['receipts', 'Đối soát', Wallet]] : [])
  ];
  return <>
    <header><div className="bar"><button className="brand" onClick={() => navigate('browse')}>
      <span className="brand-icon"><Goal size={22} aria-hidden="true" /></span><span>Smart<span>Booking</span></span>
    </button>
      <nav aria-label="Điều hướng chính">
        {links.map(([key, label, Icon]) => <button key={key} aria-current={activeScreen === key ? 'page' : undefined} onClick={() => navigate(key)}>
          <Icon size={17} aria-hidden="true" />{label}</button>)}
      </nav>
      <div className="account">{session ? <><span className="account-name">{session.fullName}</span>
        <button onClick={() => { clearSession(); navigate('browse'); }} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={17} aria-hidden="true" /></button></>
        : <button className="login-button" onClick={() => navigate('login')}><LogIn size={16} aria-hidden="true" /> Đăng nhập</button>}</div>
    </div></header>
    <main>
      {error && <div role="alert" className="error"><CircleAlert size={19} aria-hidden="true" /><span>{error}</span>
        <button onClick={() => setError('')} aria-label="Đóng lỗi"><X size={17} aria-hidden="true" /></button></div>}
      {activeScreen === 'login' && <Login onLogin={authenticate} fail={setError} paymentId={paymentId} />}
      <div hidden={activeScreen !== 'browse'}><Browse key={browseVersion} call={call} session={session}
        login={() => navigate('login')} fail={setError} visible={activeScreen === 'browse'}
        openPayment={openPayment} paymentRevision={paymentRevision} /></div>
      {screen === 'bookings' && role === 'User' && <div hidden={activeScreen !== 'bookings'}>
        <Bookings call={call} fail={setError} openPayment={openPayment} paymentRevision={paymentRevision} /></div>}
      {activeScreen === 'payment' && <div className="checkout-page">
        <button type="button" className="link" onClick={() => navigate('bookings')}><ChevronLeft size={17} aria-hidden="true" /> Lịch đặt của tôi</button>
        <BookingDetail key={paymentId} id={paymentId} initialDetail={String(initialPayment?.booking.id) === paymentId ? initialPayment : null}
          call={call} fail={setError} changed={() => setPaymentRevision(value => value + 1)} />
      </div>}
      {activeScreen === 'staffBookings' && role === 'Manager' && <ManagerSchedule call={call} fail={setError} />}
      {activeScreen === 'staffBookings' && role === 'Admin' && <Bookings call={call} fail={setError} staff />}
      {activeScreen === 'notifications' && role === 'User' && <Notifications call={call} fail={setError} />}
      {activeScreen === 'manage' && (role === 'Manager' || role === 'Admin') && <Management session={session} call={call} fail={setError} />}
      {activeScreen === 'receipts' && role === 'Admin' && <PaymentReceipts call={call} fail={setError} />}
    </main>
  </>;
}

function Login({ onLogin, fail, paymentId }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); fail('');
    try {
      if (register) await request('/auth/register', null, 'POST', body);
      onLogin(await request('/auth/login', null, 'POST', body));
    } catch (error) { fail(error.message); }
    finally { setBusy(false); }
  }
  return <section className="panel auth"><span className="panel-icon"><LogIn size={23} aria-hidden="true" /></span>
    <h1>{register ? 'Tạo tài khoản' : 'Đăng nhập'}</h1>
    {paymentId && <p className="muted">Đăng nhập bằng tài khoản User để xem lịch đặt #{paymentId}.</p>}
    <form onSubmit={submit}>
      {register && <label>Họ tên<input name="fullName" required maxLength="150" /></label>}
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mật khẩu<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength="8" /></label>
      <button className="primary" disabled={busy}>{register ? 'Đăng ký' : 'Đăng nhập'}</button>
    </form>
    <button className="link" onClick={() => setRegister(!register)}>{register ? 'Đã có tài khoản' : 'Tạo tài khoản mới'}</button>
  </section>;
}

function Browse({ call, session, login, fail, visible, openPayment, paymentRevision }) {
  const [filters, setFilters] = useState({ search: '', area: '' });
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState(null);
  const [pitch, setPitch] = useState(null);
  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(null);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [priceChange, setPriceChange] = useState(null);
  const [busy, setBusy] = useState(false);
  const [catalogueRevision, setCatalogueRevision] = useState(0);
  const [scheduleRevision, setScheduleRevision] = useState(0);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const searchForm = useRef(null);
  const resultsAnchor = useRef(null);
  const scheduleAnchor = useRef(null);
  const branches = useResult(() => call('/branches?' + new URLSearchParams({ ...filters, page, size: 9 })),
    [filters, page, catalogueRevision]);
  const pitches = useResult(() => branch ? call(`/branches/${branch.id}/pitches`) : Promise.resolve([]), [branch, catalogueRevision]);
  const slots = useResult(() => pitch && date ? call(`/pitches/${pitch.id}/availability?date=${date}`) : Promise.resolve([]),
    [pitch, date, scheduleRevision, paymentRevision]);
  const quote = useResult(() => branch && date && hour !== null
    ? call(`/branches/${branch.id}/quote?${new URLSearchParams({ date, hour })}`) : Promise.resolve(null),
    [branch, date, hour, quoteRevision]);
  const amount = createdBooking?.payment?.amountVnd ?? priceChange?.amountVnd ?? quote?.data?.amount;
  const canBook = !createdBooking && amount > 0 && slots?.data?.some(slot => slot.hour === hour && slot.available);

  function search(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setFilters({ search: data.get('search').trim(), area: data.get('area').trim() });
    setPage(1);
    focusSection(resultsAnchor.current);
  }
  function resetSearch() {
    searchForm.current.elements.search.value = '';
    searchForm.current.elements.area.value = '';
    setFilters({ search: '', area: '' });
    setPage(1);
  }
  function chooseBranch(item) {
    if (branch?.id === item.id) {
      focusSection(scheduleAnchor.current);
      return;
    }
    setBranch(item);
    setPitch(null);
    chooseHour(null);
  }
  function chooseDate(value) {
    setDate(value);
    chooseHour(null);
  }
  function chooseHour(value) {
    setHour(value);
    setCreatedBooking(null);
    setPriceChange(null);
  }
  async function book() {
    if (!canBook || busy) return;
    if (!session) return login();
    setBusy(true); fail('');
    try {
      const result = await call('/bookings', 'POST', { pitchId: pitch.id, date, hour, expectedAmountVnd: amount });
      setCreatedBooking(result);
      setPriceChange(null);
      setScheduleRevision(value => value + 1);
      openPayment(result.booking.id, result);
    } catch (error) {
      if (error.status === 409 && error.code === 'PriceChanged' && Number.isSafeInteger(error.amountVnd) && error.amountVnd > 0) {
        setPriceChange({ previousAmountVnd: amount, amountVnd: error.amountVnd });
        return;
      }
      if (error.status === 409) { chooseHour(null); setScheduleRevision(value => value + 1); }
      if (error.status === 503) {
        setPriceChange(null);
        setQuoteRevision(value => value + 1);
      }
      fail(error.message);
    }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (branch && visible) focusSection(scheduleAnchor.current);
  }, [branch, visible]);
  return <>
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-copy">
        <h1 id="hero-title">Đặt sân bóng<br /> <span>theo lịch của bạn.</span></h1>
        <p>Tìm sân gần bạn, xem giờ trống và giữ sân cho trận đấu tiếp theo.</p>
        <form ref={searchForm} className="hero-search" onSubmit={search}>
          <label>Tên chi nhánh<span className="input-icon"><Search size={17} aria-hidden="true" /><input name="search" type="search" placeholder="Ví dụ: Cộng Hòa" /></span></label>
          <label>Khu vực<span className="input-icon"><MapPin size={17} aria-hidden="true" /><input name="area" placeholder="Tất cả khu vực" /></span></label>
          <button className="hero-action">Tìm sân <ArrowRight size={18} aria-hidden="true" /></button>
        </form>
      </div>
    </section>

    <section id="chi-nhanh" className="catalogue" aria-labelledby="branches-heading">
      <div className="catalogue-heading">
        <h2 ref={resultsAnchor} id="branches-heading" tabIndex={-1}>Chọn chi nhánh</h2>
        {(filters.search || filters.area) && <button type="button" className="link" onClick={resetSearch}><X size={16} aria-hidden="true" /> Xóa bộ lọc</button>}
      </div>
      {!branches && <p className="empty" role="status">Đang tải chi nhánh…</p>}
      {branches?.error && <LoadError message={branches.error} retry={() => setCatalogueRevision(value => value + 1)} />}
      {branches?.data?.length === 0 && <p className="empty">Không tìm thấy chi nhánh phù hợp.</p>}
      <div className="branches">
        {branches?.data?.map(item => (
          <button key={item.id} className="branch" type="button" aria-pressed={branch?.id === item.id}
            disabled={busy} onClick={() => chooseBranch(item)}>
            <span className="branch-top"><span className="branch-icon"><Goal size={21} aria-hidden="true" /></span><span>{item.area}</span></span>
            <span className="branch-text"><strong>{item.name}</strong><small>{item.address}</small></span>
            <span className="branch-bottom"><span><Clock3 size={15} aria-hidden="true" /> {hourText(item.openingHour)}–{hourText(item.closingHour)}</span>
              <span className="branch-link">Xem lịch <ArrowRight size={16} aria-hidden="true" /></span></span>
          </button>
        ))}
      </div>
      <Pager page={page} setPage={setPage} more={branches?.data?.length === 9} />
    </section>

    {branch && <div className="workspace">
      <section className="panel booking-options" aria-labelledby="schedule-heading">
        <div className="booking-heading"><h2 id="schedule-heading" ref={scheduleAnchor} tabIndex={-1}>Chọn sân và giờ đá</h2>
          <a href="#chi-nhanh">Đổi chi nhánh</a></div>
        <p className="booking-location"><MapPin size={17} aria-hidden="true" /> {branch.name}</p>
        {!pitches && <p role="status" className="muted">Đang tải danh sách sân…</p>}
        {pitches?.error && <LoadError message={pitches.error} retry={() => setCatalogueRevision(value => value + 1)} />}
        {pitches?.data?.length === 0 && <p className="empty">Chi nhánh chưa có sân đang hoạt động.</p>}
        {pitches?.data?.length > 0 && <fieldset className="pitch-fieldset"><legend>Sân</legend><div className="pitch-choices">
          {pitches.data.map(item => <button key={item.id} type="button" disabled={busy} aria-pressed={pitch?.id === item.id}
            onClick={() => { if (pitch?.id !== item.id) { setPitch(item); chooseHour(null); } }}><Goal size={17} aria-hidden="true" /> {item.name}</button>)}
        </div></fieldset>}
        {pitch && <div className="time-picker">
          <label>Ngày đá<input type="date" disabled={busy} min={today()} value={date} onChange={event => chooseDate(event.target.value)} /></label>
          {date && <fieldset className="slot-fieldset"><legend>Khung giờ <small>60 phút</small></legend>
            {!slots && <p role="status" className="muted">Đang tải khung giờ…</p>}
            {slots?.error && <LoadError message={slots.error} retry={() => setScheduleRevision(value => value + 1)} />}
            {slots?.data && !slots.data.some(slot => slot.available) && <p className="muted">Ngày này không còn giờ trống.</p>}
            <div className="slots">{slots?.data?.map(slot => (
              <button key={slot.hour} type="button" disabled={busy || !slot.available} aria-pressed={hour === slot.hour}
                aria-label={slot.available ? hourText(slot.hour) : `${hourText(slot.hour)} · Không khả dụng`}
                className={!slot.available ? 'slot-unavailable' : ''} onClick={() => { if (hour !== slot.hour || createdBooking) chooseHour(slot.hour); }}>
                {hourText(slot.hour)}
              </button>
            ))}</div>
            {slots?.data?.length > 0 && <div className="slot-legend"><span>Còn trống</span><span>Đang chọn</span><span>Không khả dụng</span></div>}
          </fieldset>}
        </div>}
      </section>

      <aside className="panel booking-summary" aria-labelledby="summary-heading">
        <h2 id="summary-heading" className="section-title"><CalendarDays size={21} aria-hidden="true" /> Tóm tắt đặt sân</h2>
        <dl className="summary-details">
          <div><dt>Chi nhánh</dt><dd>{branch.name}</dd></div>
          <div><dt>Sân</dt><dd>{pitch?.name ?? 'Chưa chọn'}</dd></div>
          <div><dt>Ngày đá</dt><dd>{dayText(date)}</dd></div>
          <div><dt>Khung giờ</dt><dd>{hour === null ? 'Chưa chọn' : `${hourText(hour)}–${hourText(hour + 1)}`}</dd></div>
        </dl>
        <div className="summary-total"><span>Tổng tiền</span><strong>{amount > 0 ? money(amount) : '—'}</strong></div>
        {priceChange && <p className="price-change" role="status">Giá sân đổi từ <strong>{money(priceChange.previousAmountVnd)}</strong> thành <strong>{money(priceChange.amountVnd)}</strong>. Vui lòng xác nhận giá mới.</p>}
        {!createdBooking && hour !== null && !quote && <p className="muted" role="status">Đang lấy báo giá…</p>}
        {!createdBooking && quote?.error && <LoadError message={quote.error} retry={() => setQuoteRevision(value => value + 1)} />}
        {!createdBooking && session?.role && session.role !== 'User' ? <p className="muted">Dùng tài khoản User để đặt sân.</p> :
          !createdBooking && <button type="button" className="primary summary-action" disabled={!canBook || busy} onClick={book}>
            {busy ? 'Đang giữ sân…' : priceChange ? 'Xác nhận giá mới và giữ sân' : session ? 'Giữ sân và thanh toán' : 'Đăng nhập để đặt'} <ArrowRight size={18} aria-hidden="true" />
          </button>}
        {createdBooking && <button type="button" className="summary-action" onClick={() => openPayment(createdBooking.booking.id)}>
          Xem lịch #{createdBooking.booking.id} <ArrowRight size={18} aria-hidden="true" />
        </button>}
      </aside>
    </div>}

  </>;
}

function BookingDetail({ id, initialDetail = null, call, fail, changed, staff = false }) {
  const endpoint = staff ? '/management/bookings/' : '/bookings/';
  const [detail, setDetail] = useState(initialDetail);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(Date.now);
  const previousStatus = useRef(initialDetail?.booking.status);
  const expiresAt = detail?.booking.status === 'PendingPayment' ? detail.booking.expiresAtUtc : null;
  const remaining = expiresAt ? Math.max(0, Math.ceil((utcDate(expiresAt).getTime() - now) / 1000)) : 0;

  useEffect(() => {
    if (!expiresAt) return;
    const deadline = utcDate(expiresAt).getTime();
    function tick() {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= deadline) clearInterval(timer);
    }
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
  }, [expiresAt]);

  useEffect(() => {
    let current = true;
    let timer;
    async function refresh() {
      try {
        const next = await call(endpoint + id);
        if (!current) return;
        setNow(Date.now());
        setDetail(next);
        setLoadError('');
        const status = next.booking.status;
        if (status === 'PendingPayment') timer = setTimeout(refresh, 3000);
        else if (previousStatus.current === 'PendingPayment') changed();
        previousStatus.current = status;
      } catch (error) {
        if (!current) return;
        setLoadError(error.message);
        if (!error.status || error.status >= 500) timer = setTimeout(refresh, 5000);
      }
    }
    refresh();
    return () => { current = false; clearTimeout(timer); };
  }, [id, revision, endpoint]);
  function reload() {
    setLoadError('');
    setRevision(value => value + 1);
  }
  if (!detail) return <section className="panel">
    {loadError ? <><p role="alert">{loadError}</p><button onClick={reload}>Thử lại</button></> : <p role="status">Đang tải lịch đặt…</p>}
  </section>;
  const { booking, payment } = detail;
  const pending = booking.status === 'PendingPayment';
  const canPay = !staff && pending && remaining > 0;
  const countdown = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  async function cancel() {
    setBusy(true);
    fail('');
    try {
      await call(endpoint + id + '/cancel', 'POST');
      reload();
    } catch (error) {
      if (error.status === 409) reload();
      fail(error.message);
    }
    finally { setBusy(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(payment.code); setCopied(true); }
    catch { fail('Không sao chép được. Bạn có thể chọn và chép mã trực tiếp.'); }
  }
  return <section className="panel payment">
    <div className="payment-content">
      <div className="payment-heading"><h2 className="section-title"><Wallet size={22} aria-hidden="true" /> Lịch đặt #{id}</h2>
        <Status value={booking.status} /></div>
      <p className="payment-time"><CalendarDays size={16} aria-hidden="true" /> {time(booking.startAtUtc)}</p>
      {loadError && <LoadError message={loadError} retry={reload} />}
      <p className="payment-value"><span>{canPay ? 'Số tiền cần chuyển' : 'Tổng tiền'}</span>
        <strong>{money(payment?.amountVnd ?? booking.priceVnd)}</strong></p>
      {payment && <div className="payment-code"><div><span>{canPay ? 'Nội dung chuyển khoản' : 'Mã thanh toán'}</span><code>{payment.code}</code></div>
        {canPay && <button type="button" onClick={copyCode}>{copied ? <><Check size={15} aria-hidden="true" /> Đã chép</> : 'Sao chép'}</button>}</div>}
      {pending && (remaining > 0 ? <p className="payment-deadline"><Clock3 size={18} aria-hidden="true" />
        <span>Giữ sân đến {time(expiresAt)}</span><strong aria-label="Thời gian còn lại">{countdown}</strong></p>
        : <p role="status">Đã đến hạn giữ sân. Đang kiểm tra trạng thái thanh toán…</p>)}
      {canPay && <>
        {payment?.isDemo && <p className="demo-note">Giao dịch mô phỏng. Dùng script demo để xác nhận, không chuyển tiền thật.</p>}
        {!payment?.qrUrl && !payment?.isDemo && <p>Chưa có mã VietQR cho lịch này.</p>}
        <button type="button" className="cancel-hold" disabled={busy} onClick={cancel}>Hủy giữ sân</button>
      </>}
    </div>
    {canPay && payment?.qrUrl && <figure className="payment-qr">
      <figcaption>Quét VietQR để thanh toán</figcaption>
      <img src={payment.qrUrl} alt="VietQR thanh toán cho lượt đặt này" />
    </figure>}
  </section>;
}

function Pager({ page, setPage, more }) {
  if (!more && page === 1) return null;
  return <div className="pager"><button disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /> Trước</button>
    <span>Trang {page}</span><button disabled={!more} onClick={() => setPage(page + 1)}>Sau <ChevronRight size={15} /></button></div>;
}

function ManagerSchedule({ call, fail }) {
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const branches = useResult(signal => call('/management/branches', 'GET', undefined, signal), [revision]);
  const branch = branches?.data?.[0];
  const bookings = useResult(async signal => {
    if (!branch) return [];
    const rows = new Map();
    const size = 100;
    for (let page = 1; page <= 10000; page++) {
      const query = new URLSearchParams({ branchId: branch.id, date, status, sort: 'asc', page, size });
      const batch = await call('/management/bookings?' + query, 'GET', undefined, signal);
      for (const row of batch) rows.set(row.booking.id, row);
      if (batch.length < size) break;
    }
    return [...rows.values()];
  }, [branch?.id, date, status, revision]);

  const courts = new Map();
  for (const row of bookings?.data ?? []) {
    const id = row.booking.pitchId;
    if (!courts.has(id)) courts.set(id, { id, name: row.name, rows: [] });
    courts.get(id).rows.push(row);
  }
  const schedule = [...courts.values()].sort((first, second) => first.name.localeCompare(second.name, 'vi', { numeric: true }));
  const minDate = '1000-01-01';
  const maxDate = '9998-12-31';

  function chooseDay(next) {
    if (!next || next === date) return;
    setDate(next);
    setSelected(null);
  }
  function stepDay(days) {
    const day = new Date(`${date}T00:00:00Z`);
    day.setUTCDate(day.getUTCDate() + days);
    chooseDay(day.toISOString().slice(0, 10));
  }
  function refresh() { setRevision(value => value + 1); }

  return <section className="panel manager-schedule" aria-labelledby="manager-schedule-heading">
    <div className="manager-schedule-heading">
      <div><h1 id="manager-schedule-heading">Lịch sân</h1>
        {branch && <p><MapPin size={16} aria-hidden="true" /> {branch.name}</p>}</div>
      <button type="button" onClick={() => { setSelected(null); refresh(); }}>
        <RefreshCw size={16} aria-hidden="true" /> Làm mới
      </button>
    </div>

    <div className="manager-schedule-filters">
      <div className="manager-day-controls">
        <button type="button" aria-label="Ngày trước" disabled={date === minDate} onClick={() => stepDay(-1)}><ChevronLeft size={18} aria-hidden="true" /></button>
        <input type="date" aria-label="Ngày đá" value={date} min={minDate} max={maxDate} required
          onChange={event => { if (event.target.validity.valid) chooseDay(event.target.value); }} />
        <button type="button" aria-label="Ngày sau" disabled={date === maxDate} onClick={() => stepDay(1)}><ChevronRight size={18} aria-hidden="true" /></button>
        <button type="button" aria-pressed={date === today()} onClick={() => chooseDay(today())}>Hôm nay</button>
      </div>
      <select aria-label="Trạng thái" value={status} onChange={event => { setStatus(event.target.value); setSelected(null); }}>
        <option value="">Tất cả trạng thái</option>
        {Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>
    </div>

    {(!branches || (branch && !bookings)) && <p role="status" className="muted">Đang tải lịch sân…</p>}
    {branches?.error && <LoadError message={branches.error} retry={refresh} />}
    {branches?.data?.length === 0 && <p className="empty">Bạn chưa được phân công chi nhánh.</p>}
    {branch && bookings?.error && <LoadError message={bookings.error} retry={refresh} />}
    {branch && bookings?.data?.length === 0 && <p className="empty">{status ? 'Không có lịch phù hợp với trạng thái đã chọn.' : 'Ngày này chưa có lịch đặt.'}</p>}

    <div className={selected ? 'manager-schedule-layout with-detail' : 'manager-schedule-layout'}>
      <div className="manager-courts">
        {schedule.map(court => (
          <section className="court-schedule" key={court.id} aria-labelledby={`court-${court.id}`}>
            <div className="court-heading"><h2 id={`court-${court.id}`}><Goal size={19} aria-hidden="true" /> {court.name}</h2>
              <small>{court.rows.length} lịch</small></div>
            <div className="court-slots">
              {court.rows.map(({ booking }) => (
                <button type="button" key={booking.id} aria-pressed={selected === booking.id} onClick={() => setSelected(booking.id)}>
                  <strong>{scheduleClock.format(utcDate(booking.startAtUtc))}{booking.endAtUtc && `–${scheduleClock.format(utcDate(booking.endAtUtc))}`}</strong>
                  <small>#{booking.id}</small><Status value={booking.status} /><ChevronRight size={16} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
      {selected && <aside className="manager-booking-detail" aria-label="Chi tiết lịch đặt">
        <button className="link" type="button" onClick={() => setSelected(null)}><X size={17} aria-hidden="true" /> Đóng chi tiết</button>
        <BookingDetail key={selected} id={selected} call={call} fail={fail} staff changed={refresh} />
      </aside>}
    </div>
  </section>;
}

function Bookings({ call, fail, staff = false, openPayment, paymentRevision }) {
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [sort, setSort] = useState('desc');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const branches = useData(() => staff ? call('/management/branches') : Promise.resolve([]), [staff], fail);
  const endpoint = staff ? '/management/bookings' : '/bookings';
  const rows = useData(() => call(endpoint + '?' + new URLSearchParams({
    status, sort, page, size: 15, ...(date && { date }), ...(branchId && { branchId })
  })), [status, date, sort, branchId, page, revision, paymentRevision], fail);
  return <><section className="panel"><h1>{staff ? 'Lịch vận hành' : 'Lịch đặt của tôi'}</h1><div className="filters">
    {staff && <select aria-label="Chi nhánh" value={branchId} onChange={e => { setBranchId(e.target.value); setPage(1); }}>
      <option value="">Tất cả chi nhánh</option>{branches?.map(branch => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
    </select>}
    <select aria-label="Trạng thái" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
      <option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
    </select><input aria-label="Ngày đá" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} />
    <select aria-label="Sắp xếp" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
      <option value="desc">Giờ đá giảm dần</option><option value="asc">Giờ đá tăng dần</option>
    </select></div>
    {rows === null && <p role="status" className="muted">Đang tải lịch đặt…</p>}
    <div className="rows">{rows?.map(row => <button key={row.booking.id} aria-pressed={selected === row.booking.id}
      onClick={() => staff ? setSelected(row.booking.id) : openPayment(row.booking.id)}>
      <strong>#{row.booking.id} · {row.name}</strong><span>{time(row.booking.startAtUtc)}</span><Status value={row.booking.status} />
    </button>)}</div>{rows?.length === 0 && <p>Chưa có lịch đặt.</p>}
    <Pager page={page} setPage={setPage} more={rows?.length === 15} /></section>
    {selected && <BookingDetail key={selected} id={selected} call={call} fail={fail} staff={staff}
      changed={() => setRevision(value => value + 1)} />}
  </>;
}

function Notifications({ call, fail }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const result = useResult(signal => call('/notifications?' + new URLSearchParams({ page, size: 15 }), 'GET', undefined, signal),
    [page, revision], { refreshMs: page === 1 ? 3000 : 0 });
  const rows = result?.data;
  function reload() { setRevision(value => value + 1); }
  async function read(id) {
    try { await call('/notifications/' + id + '/read', 'POST'); reload(); }
    catch (error) { fail(error.message); }
  }
  return <section className="panel"><h1 className="section-title"><Bell size={25} aria-hidden="true" /> Thông báo</h1>
    {!result && <p role="status" className="muted">Đang tải thông báo…</p>}
    {result?.error && <LoadError message={result.error} retry={reload} />}
    <div className="rows">
    {rows?.map(row => <div key={row.id} className={!row.readAtUtc ? 'unread' : ''}><span>{row.message}</span><small>{time(row.createdAtUtc)}</small>
      {!row.readAtUtc && <button onClick={() => read(row.id)}>Đánh dấu đã đọc</button>}</div>)}
  </div>{rows?.length === 0 && !result.error && <p>Chưa có thông báo.</p>}
  <Pager page={page} setPage={setPage} more={rows?.length === 15} /></section>;
}

function PaymentReceipts({ call, fail }) {
  const [page, setPage] = useState(1);
  const rows = useData(() => call('/admin/payment-receipts?page=' + page + '&size=15'), [page], fail);
  return <section className="panel"><h1>Đối soát thanh toán</h1>
    <div className="rows">{rows?.map(row => <div key={row.sepayId}>
      <strong>Lịch #{row.bookingId} · {row.code}</strong>
      <span>{row.outcome === 'AmountMismatch' ? 'Sai số tiền' : 'Lịch không còn chờ thanh toán'}</span>
      <span>Nhận {money(row.amountVnd)} / cần {money(row.expectedAmountVnd)}</span>
      <small>SePay #{row.sepayId} · {time(row.receivedAtUtc)}</small>
    </div>)}</div>
    {rows?.length === 0 && <p>Không có giao dịch cần đối soát.</p>}
    <Pager page={page} setPage={setPage} more={rows?.length === 15} />
  </section>;
}

function Management({ session, call, fail }) {
  const [addingPitch, setAddingPitch] = useState(false);
  const admin = session.role === 'Admin';
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState(false);
  const [policyId, setPolicyId] = useState(null);
  const [revision, setRevision] = useState(0);
  const branches = useData(() => call('/management/branches'), [revision], fail);
  const managers = useData(() => admin ? call('/admin/managers') : Promise.resolve([]), [revision], fail);
  const branch = branches?.find(row => String(row.id) === selected);
  const prefix = '/management/branches/' + selected;
  const pitches = useData(() => selected ? call(prefix + '/pitches') : Promise.resolve([]), [selected, revision], fail);
  const prices = useData(() => selected ? call(prefix + '/prices') : Promise.resolve([]), [selected, revision], fail);
  const policy = prices?.find(row => row.id === policyId);
  async function action(path, method, body) {
    fail('');
    try { await call(path, method, body); setRevision(value => value + 1); return true; }
    catch (error) { fail(error.message); return false; }
  }
  function submit(handler) {
    return event => { event.preventDefault(); handler(Object.fromEntries(new FormData(event.currentTarget))); };
  }
  return <section className="panel"><h1>Quản lý chi nhánh</h1>
    <label>Chi nhánh<select value={selected} onChange={e => { setSelected(e.target.value); setEditing(false); setPolicyId(null); }}>
      <option value="">Chọn chi nhánh</option>{branches?.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select></label>
    {admin && <div className="management-grid">
      <form key={editing ? selected : 'new'} onSubmit={submit(async data => {
        const success = await action('/admin/branches' + (editing ? '/' + selected : ''), editing ? 'PUT' : 'POST', {
          ...data, openingHour: Number(data.openingHour), closingHour: Number(data.closingHour), isActive: data.isActive === 'true'
        }); if (success) setEditing(false);
      })}>
        <h2>{editing ? 'Sửa chi nhánh' : 'Tạo chi nhánh'}</h2>
        <label>Tên<input name="name" defaultValue={editing ? branch?.name : ''} required /></label>
        <label>Địa chỉ<input name="address" defaultValue={editing ? branch?.address : ''} required /></label>
        <label>Khu vực<input name="area" defaultValue={editing ? branch?.area : ''} required /></label>
        <div className="filters"><label>Giờ mở<input name="openingHour" type="number" min="0" max="23" defaultValue={editing ? branch?.openingHour : 6} required /></label>
        <label>Giờ đóng<input name="closingHour" type="number" min="1" max="24" defaultValue={editing ? branch?.closingHour : 22} required /></label></div>
        <label>Trạng thái<select name="isActive" defaultValue={editing ? String(branch?.isActive) : 'true'}>
          <option value="true">Hoạt động</option><option value="false">Tạm ngừng</option></select></label>
        <div className="chips"><button className="primary">Lưu chi nhánh</button>
          {branch && <button type="button" onClick={() => setEditing(!editing)}>{editing ? 'Tạo mới' : 'Sửa chi nhánh đã chọn'}</button>}</div>
      </form>
      <div><form onSubmit={submit(data => action('/admin/managers', 'POST', data))}>
        <h2>Tạo Manager</h2><label>Họ tên<input name="fullName" required /></label><label>Email<input name="email" type="email" required /></label>
        <label>Mật khẩu<input name="password" type="password" minLength="8" required /></label><button className="primary">Tạo tài khoản</button>
      </form>
      {selected && <form onSubmit={submit(data => action('/admin/branches/' + selected + '/manager', data.managerId ? 'PUT' : 'DELETE',
        data.managerId ? { managerId: Number(data.managerId) } : undefined))}>
        <label>Manager phụ trách<select key={revision + selected + (managers ? 'loaded' : '')} name="managerId"
          defaultValue={managers?.find(row => String(row.branchId) === selected)?.id || ''}>
          <option value="">Chưa phân công</option>{managers?.map(row => <option key={row.id} value={row.id}>{row.fullName} · {row.email}</option>)}
        </select></label><button>Lưu phân công</button>
      </form>}</div>
    </div>}
    {selected && <div className="management-grid">
      <div><h2>Sân bóng</h2>
        <form key={selected} onSubmit={async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setAddingPitch(true);
          try {
            if (await action(prefix + '/pitches', 'POST', { name: data.get('name'), isActive: true })) form.reset();
          } finally { setAddingPitch(false); }
        }}>
          <label>Tên sân mới<input name="name" maxLength="120" placeholder="Ví dụ: Sân 4" required /></label>
          <button className="primary" disabled={addingPitch}><Plus size={17} aria-hidden="true" />{addingPitch ? 'Đang thêm…' : 'Thêm sân'}</button>
        </form>
        {pitches?.length === 0 && <p className="muted">Chi nhánh chưa có sân.</p>}
        {pitches?.map(pitch => <form key={pitch.id} className="pitch-edit" onSubmit={submit(data =>
        action('/management/pitches/' + pitch.id, 'PUT', { name: data.name, isActive: data.active === 'on' }))}>
        <label>Tên sân số {pitch.pitchNumber}<input name="name" defaultValue={pitch.name} required /></label>
        <label className="check"><input name="active" type="checkbox" defaultChecked={pitch.isActive} /> Đang hoạt động</label>
        <button>Lưu sân</button></form>)}</div>
      <div><h2>Bảng giá</h2><div className="rows">{prices?.map(row => <div key={row.id}>
        <span>{row.effectiveFrom} · {money(row.regularPriceVnd)} / {money(row.peakPriceVnd)}</span>
        <button onClick={() => setPolicyId(row.id)}>Sửa</button><button onClick={async () => {
          if (window.confirm('Xóa bảng giá này?') && await action(prefix + '/prices/' + row.id, 'DELETE')) setPolicyId(null);
        }}>Xóa</button></div>)}</div>
        <form key={policy?.id || 'new'} onSubmit={submit(async data => {
          const success = await action(prefix + '/prices' + (policy ? '/' + policy.id : ''), policy ? 'PUT' : 'POST', {
            effectiveFrom: data.effectiveFrom, regularPriceVnd: Number(data.regularPriceVnd), peakPriceVnd: Number(data.peakPriceVnd),
            peakStartHour: Number(data.peakStartHour), peakEndHour: Number(data.peakEndHour)
          }); if (success) setPolicyId(null);
        })}>
          <label>Ngày hiệu lực<input name="effectiveFrom" type="date" defaultValue={policy?.effectiveFrom || today()} required /></label>
          <div className="filters"><label>Giá thường (VND)<input name="regularPriceVnd" type="number" min="1" defaultValue={policy?.regularPriceVnd} required /></label>
          <label>Giá cao điểm (VND)<input name="peakPriceVnd" type="number" min="1" defaultValue={policy?.peakPriceVnd} required /></label></div>
          <div className="filters"><label>Từ giờ<input name="peakStartHour" type="number" min="0" max="23" defaultValue={policy?.peakStartHour ?? 18} required /></label>
          <label>Đến giờ<input name="peakEndHour" type="number" min="1" max="24" defaultValue={policy?.peakEndHour ?? 22} required /></label></div>
          <div className="chips"><button className="primary">{policy ? 'Lưu bảng giá' : 'Thêm bảng giá'}</button>
            {policy && <button type="button" onClick={() => setPolicyId(null)}>Tạo bảng mới</button>}</div>
        </form>
      </div>
    </div>}
  </section>;
}

createRoot(document.getElementById('root')).render(<App />);
