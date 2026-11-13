import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, CircleAlert,
  CircleCheck, Clock3, Goal, LogIn, LogOut, MapPin, Plus, Search, Settings2, Wallet, X
} from 'lucide-react';
import './style.css';

const base = import.meta.env.VITE_API_URL ?? '';
const money = value => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
const time = value => value ? new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh'
}).format(new Date(value.endsWith('Z') ? value : value + 'Z')) : '';
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
const labels = { PendingPayment: 'Chờ thanh toán', Confirmed: 'Đã xác nhận', Completed: 'Hoàn tất', Cancelled: 'Đã hủy', Expired: 'Hết hạn' };

async function request(path, token, method = 'GET', body) {
  const response = await fetch(base + '/api' + path, {
    method,
    headers: { ...(token && { Authorization: 'Bearer ' + token }), ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const failure = new Error(error.message || error.detail || ({
      400: 'Dữ liệu không hợp lệ.', 401: 'Thông tin đăng nhập không đúng hoặc phiên đã hết hạn.',
      403: 'Bạn không có quyền thực hiện thao tác này.', 404: 'Không tìm thấy dữ liệu.'
    })[response.status] || 'Yêu cầu thất bại (' + response.status + ').');
    failure.status = response.status;
    throw failure;
  }
  return response.status === 204 ? null : response.json();
}

function useData(load, dependencies, onError) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let current = true;
    load().then(value => { if (current) setResult({ dependencies, value }); })
      .catch(error => { if (current) { setResult({ dependencies, value: [] }); onError(error.message); } });
    return () => { current = false; };
  }, dependencies);
  return result && dependencies.every((value, index) => Object.is(value, result.dependencies[index]))
    ? result.value : null;
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
  const [error, setError] = useState('');
  const [browseVersion, setBrowseVersion] = useState(0);
  function navigate(next) { setError(''); setScreen(next); }
  function authenticate(next) {
    setSession(next);
    if (next) sessionStorage.setItem('football-session', JSON.stringify(next));
    else { sessionStorage.removeItem('football-session'); setBrowseVersion(value => value + 1); }
    navigate(next && next.role !== 'User' ? 'manage' : 'browse');
  }
  const call = async (path, method, body) => {
    try { return await request(path, session?.token, method, body); }
    catch (error) {
      if (session && error.status === 401) { authenticate(null); navigate('login'); }
      throw error;
    }
  };
  const links = [
    ['browse', 'Tìm sân', MapPin],
    ...(session ? [['bookings', 'Lịch đặt', CalendarDays]] : []),
    ...(session?.role === 'User' ? [['notifications', 'Thông báo', Bell]] : []),
    ...(session && session.role !== 'User' ? [['manage', 'Quản lý', Settings2]] : []),
    ...(session?.role === 'Admin' ? [['receipts', 'Đối soát', Wallet]] : [])
  ];
  return <>
    <header><div className="bar"><button className="brand" onClick={() => navigate('browse')}>
      <span className="brand-icon"><Goal size={22} aria-hidden="true" /></span><span>Smart<span>Booking</span></span>
    </button>
      <nav aria-label="Điều hướng chính">
        {links.map(([key, label, Icon]) => <button key={key} aria-current={screen === key ? 'page' : undefined} onClick={() => navigate(key)}>
          <Icon size={17} aria-hidden="true" />{label}</button>)}
      </nav>
      <div className="account">{session ? <><span className="account-name">{session.fullName}</span>
        <button onClick={() => authenticate(null)} aria-label="Đăng xuất" title="Đăng xuất"><LogOut size={17} aria-hidden="true" /></button></>
        : <button className="login-button" onClick={() => navigate('login')}><LogIn size={16} aria-hidden="true" /> Đăng nhập</button>}</div>
    </div></header>
    <main>
      {error && <div role="alert" className="error"><CircleAlert size={19} aria-hidden="true" /><span>{error}</span>
        <button onClick={() => setError('')} aria-label="Đóng lỗi"><X size={17} aria-hidden="true" /></button></div>}
      {screen === 'login' && <Login onLogin={authenticate} fail={setError} />}
      <div hidden={screen !== 'browse'}><Browse key={browseVersion} call={call} session={session}
        login={() => navigate('login')} fail={setError} visible={screen === 'browse'} /></div>
      {screen === 'bookings' && session && <Bookings call={call} fail={setError} admin={session.role === 'Admin'} />}
      {screen === 'notifications' && session && <Notifications call={call} fail={setError} />}
      {screen === 'manage' && session && <Management session={session} call={call} fail={setError} />}
      {screen === 'receipts' && session?.role === 'Admin' && <PaymentReceipts call={call} fail={setError} />}
    </main>
  </>;
}

function Login({ onLogin, fail }) {
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
    <form onSubmit={submit}>
      {register && <label>Họ tên<input name="fullName" required maxLength="150" /></label>}
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Mật khẩu<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength="8" /></label>
      <button className="primary" disabled={busy}>{register ? 'Đăng ký' : 'Đăng nhập'}</button>
    </form>
    <button className="link" onClick={() => setRegister(!register)}>{register ? 'Đã có tài khoản' : 'Tạo tài khoản mới'}</button>
  </section>;
}

function Browse({ call, session, login, fail, visible }) {
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [page, setPage] = useState(1);
  const [branch, setBranch] = useState(null);
  const [pitch, setPitch] = useState(null);
  const [date, setDate] = useState(today);
  const [hour, setHour] = useState(null);
  const [bookingId, setBookingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const detailAnchor = useRef(null);
  const branches = useData(() => call('/branches?' + new URLSearchParams({ search, area, page, size: 9 })), [search, area, page], fail);
  const pitches = useData(() => branch ? call('/branches/' + branch.id + '/pitches') : Promise.resolve([]), [branch], fail);
  const slots = useData(() => pitch && date ? call('/pitches/' + pitch.id + '/availability?date=' + date) : Promise.resolve([]), [pitch, date, revision], fail);
  const quote = useData(() => branch && date && hour !== null ? call('/branches/' + branch.id + '/quote?date=' + date + '&hour=' + hour) : Promise.resolve(null), [branch, date, hour], fail);
  async function book() {
    if (!session) return login();
    setBusy(true); fail('');
    try {
      const result = await call('/bookings', 'POST', { pitchId: pitch.id, date, hour });
      setBookingId(result.booking.id);
    } catch (error) {
      if (error.status === 409) { setHour(null); setRevision(value => value + 1); }
      fail(error.message);
    }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (bookingId && visible) detailAnchor.current?.scrollIntoView({ block: 'nearest' });
  }, [bookingId, visible]);
  return <>
    <section className="hero"><div className="hero-copy"><h1>Đặt sân bóng</h1>
      <p>Tìm sân trống, chọn giờ đá và giữ chỗ cho đội của bạn.</p>
      <a href="#chi-nhanh" className="hero-action">Chọn sân <ArrowRight size={18} aria-hidden="true" /></a></div></section>
    <div className="workspace">
      <section id="chi-nhanh" className="panel"><h2 className="section-title"><MapPin size={21} aria-hidden="true" /> Chi nhánh</h2><div className="filters">
        <div className="input-icon"><Search size={17} aria-hidden="true" /><input aria-label="Tên chi nhánh" placeholder="Tìm theo tên" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></div>
        <input aria-label="Khu vực" placeholder="Khu vực" value={area} onChange={e => { setArea(e.target.value); setPage(1); }} />
      </div><div className="branches">
        {branches?.map(item => <button aria-pressed={branch?.id === item.id} disabled={busy} className={branch?.id === item.id ? 'selected branch' : 'branch'} key={item.id} onClick={() => {
          setBranch(item); setPitch(null); setHour(null); setBookingId(null);
        }}><span className="branch-icon"><MapPin size={18} aria-hidden="true" /></span><span className="branch-text">
          <strong>{item.name}</strong><small>{item.address} · {item.area}</small></span><ChevronRight size={17} aria-hidden="true" /></button>)}
        {branches === null && <p role="status" className="muted">Đang tải chi nhánh…</p>}
        {branches?.length === 0 && <p>Không tìm thấy chi nhánh.</p>}
      </div><Pager page={page} setPage={setPage} more={branches?.length === 9} /></section>
      <section className="panel"><h2 className="section-title"><CalendarDays size={21} aria-hidden="true" />{branch?.name || 'Sân và khung giờ'}</h2>
        {!branch && <div className="empty"><CalendarDays size={29} aria-hidden="true" /><p>Chọn chi nhánh để xem sân và giờ trống.</p></div>}
        {branch && <>
          <div className="chips">{pitches?.map(item => <button key={item.id} disabled={busy} aria-pressed={pitch?.id === item.id} className={pitch?.id === item.id ? 'selected' : ''}
            onClick={() => { setPitch(item); setHour(null); setBookingId(null); }}>{item.name}</button>)}</div>
          {pitches?.length === 0 && <p>Chi nhánh chưa có sân đang hoạt động.</p>}
          {pitch && <><label>Ngày đá<input type="date" disabled={busy} min={today()} value={date} onChange={e => {
            setDate(e.target.value); setHour(null); setBookingId(null);
          }} /></label>
          {date && slots === null && <p role="status" className="muted">Đang tải khung giờ…</p>}
          {date && slots?.length > 0 && !slots.some(slot => slot.available) && <p className="muted">Ngày này không còn giờ trống.</p>}
          <div className="slots">{slots?.map(slot => <button key={slot.hour} disabled={busy || !slot.available} aria-pressed={hour === slot.hour}
            className={hour === slot.hour ? 'selected' : ''} onClick={() => { setHour(slot.hour); setBookingId(null); }}>
            {String(slot.hour).padStart(2, '0')}:00
          </button>)}</div></>}
          {hour !== null && quote?.amount > 0 && !bookingId && <div className="checkout"><div><small>Giá 60 phút</small><strong>{money(quote.amount)}</strong></div>
            {session?.role && session.role !== 'User' ? <span>Dùng tài khoản User để đặt sân.</span>
              : <button className="primary" disabled={busy} onClick={book}>{busy ? 'Đang giữ sân…' : session ? 'Giữ sân và thanh toán' : 'Đăng nhập để đặt'} <ArrowRight size={17} aria-hidden="true" /></button>}</div>}
        </>}
      </section>
    </div>
    {bookingId && <div ref={detailAnchor}><BookingDetail key={bookingId} id={bookingId} call={call} fail={fail}
      changed={() => setRevision(value => value + 1)} /></div>}
  </>;
}

function BookingDetail({ id, call, fail, changed }) {
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let current = true;
    let timer;
    async function refresh() {
      try {
        const next = await call('/bookings/' + id);
        if (!current) return;
        setDetail(next);
        if (next.booking.status === 'PendingPayment') timer = setTimeout(refresh, 3000);
        else changed?.();
      } catch (error) {
        if (!current) return;
        fail(error.message);
        if (!error.status || error.status >= 500) timer = setTimeout(refresh, 5000);
      }
    }
    refresh();
    return () => { current = false; clearTimeout(timer); };
  }, [id, revision]);
  if (!detail) return <section className="panel"><p>Đang tải lịch đặt…</p></section>;
  const { booking, payment } = detail;
  async function cancel() {
    setBusy(true);
    try {
      await call('/bookings/' + id + '/cancel', 'POST');
      setRevision(value => value + 1);
    } catch (error) { fail(error.message); }
    finally { setBusy(false); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(payment.code); setCopied(true); }
    catch { fail('Không sao chép được. Bạn có thể chọn và chép mã trực tiếp.'); }
  }
  return <section className="panel payment"><div>
    <h2 className="section-title"><Wallet size={21} aria-hidden="true" /> Lịch đặt #{id}</h2>
    <div className="payment-meta"><span>{time(booking.startAtUtc)}</span><Status value={booking.status} /></div>
    {payment && <><p className="payment-amount">{money(payment.amountVnd)}</p><div className="payment-meta">
      <span>Mã thanh toán <code>{payment.code}</code></span><button onClick={copyCode}>{copied ? <><Check size={15} /> Đã chép</> : 'Sao chép'}</button></div></>}
    {booking.status === 'PendingPayment' && <>
      <p>Giữ sân đến {time(booking.expiresAtUtc)}.</p>
      {payment?.isDemo && <p className="demo-note">Giao dịch mô phỏng. Dùng script demo để xác nhận, không chuyển tiền thật.</p>}
      {!payment?.qrUrl && !payment?.isDemo && <p>Chưa có mã VietQR cho lịch này.</p>}
      <button disabled={busy} onClick={cancel}>Hủy giữ sân</button>
    </>}
    </div>{booking.status === 'PendingPayment' && payment?.qrUrl &&
      <img src={payment.qrUrl} alt="VietQR thanh toán cho lượt đặt này" />}</section>;
}

function Pager({ page, setPage, more }) {
  if (!more && page === 1) return null;
  return <div className="pager"><button disabled={page === 1} onClick={() => setPage(page - 1)}><ChevronLeft size={15} /> Trước</button>
    <span>Trang {page}</span><button disabled={!more} onClick={() => setPage(page + 1)}>Sau <ChevronRight size={15} /></button></div>;
}

function Bookings({ call, fail, admin }) {
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('');
  const [date, setDate] = useState('');
  const [sort, setSort] = useState('desc');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState(null);
  const branches = useData(() => admin ? call('/admin/branches') : Promise.resolve([]), [admin], fail);
  const rows = useData(() => call('/bookings?' + new URLSearchParams({
    status, sort, page, size: 15, ...(date && { date }), ...(branchId && { branchId })
  })), [status, date, sort, branchId, page, revision], fail);
  return <><section className="panel"><h1>Lịch đặt</h1><div className="filters">
    {admin && <select aria-label="Chi nhánh" value={branchId} onChange={e => { setBranchId(e.target.value); setPage(1); }}>
      <option value="">Tất cả chi nhánh</option>{branches?.map(branch => <option value={branch.id} key={branch.id}>{branch.name}</option>)}
    </select>}
    <select aria-label="Trạng thái" value={status} onChange={e => { setStatus(e.target.value); setPage(1); }}>
      <option value="">Tất cả trạng thái</option>{Object.entries(labels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
    </select><input aria-label="Ngày đá" type="date" value={date} onChange={e => { setDate(e.target.value); setPage(1); }} />
    <select aria-label="Sắp xếp" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
      <option value="desc">Giờ đá giảm dần</option><option value="asc">Giờ đá tăng dần</option>
    </select></div>
    <div className="rows">{rows?.map(row => <button key={row.booking.id} onClick={() => setSelected(row.booking.id)}>
      <strong>#{row.booking.id} · {row.name}</strong><span>{time(row.booking.startAtUtc)}</span><Status value={row.booking.status} />
    </button>)}</div>{rows?.length === 0 && <p>Chưa có lịch đặt.</p>}
    <Pager page={page} setPage={setPage} more={rows?.length === 15} /></section>
    {selected && <BookingDetail key={selected} id={selected} call={call} fail={fail} changed={() => setRevision(value => value + 1)} />}
  </>;
}

function Notifications({ call, fail }) {
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const rows = useData(() => call('/notifications?' + new URLSearchParams({ page, size: 15 })), [page, revision], fail);
  async function read(id) {
    try { await call('/notifications/' + id + '/read', 'POST'); setRevision(revision + 1); }
    catch (error) { fail(error.message); }
  }
  return <section className="panel"><h1 className="section-title"><Bell size={25} aria-hidden="true" /> Thông báo</h1><div className="rows">
    {rows?.map(row => <div key={row.id} className={!row.readAtUtc ? 'unread' : ''}><span>{row.message}</span><small>{time(row.createdAtUtc)}</small>
      {!row.readAtUtc && <button onClick={() => read(row.id)}>Đánh dấu đã đọc</button>}</div>)}
  </div>{rows?.length === 0 && <p>Chưa có thông báo.</p>}
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
