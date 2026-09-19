import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const C = window.YTM_CONFIG;
const sb = createClient(C.supabaseUrl, C.supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const yen = (n) => new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(Number(n||0));
const localDateKey = (d=new Date()) => {
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const today = () => localDateKey();
const fmt = (d) => d ? new Date(d+'T00:00:00').toLocaleDateString('ja-JP') : '';
const VERIFICATION_STATES = ['確定','確認済み','申告','推定','未確認','矛盾','対象外'];

let state = {
  page:'home', session:null, partners:[], attendance:[], documents:[], workers:[], photos:[],
  selected:null, online:navigator.onLine, queueCount:0, usingCache:false
};
const nav=[['home','HOME'],['attendance','出面'],['partners','協力会社'],['alerts','期限'],['roster','作業員'],['audit','監査']];

function toast(msg){const e=document.createElement('div');e.className='toast';e.textContent=msg;document.body.append(e);setTimeout(()=>e.remove(),3200)}
function badge(text,kind=''){return `<span class="badge ${kind}">${esc(text)}</span>`}
function setTitle(t,e='業務コンソール'){$('#pageTitle').textContent=t;$('#pageEyebrow').textContent=e}
function renderNav(){
  $('#nav').innerHTML=nav.map(([k,l])=>`<button data-page="${k}" class="${state.page===k?'active':''}">${l}</button>`).join('');
  $('#nav').querySelectorAll('button').forEach(b=>b.onclick=()=>go(b.dataset.page));
}
function go(page,id=null){state.page=page;state.selected=id;renderNav();render()}
function syncPill(){
  const e=$('#syncStatus');
  if(!e)return;
  if(!state.online){e.textContent=`オフライン${state.queueCount?`・未送信${state.queueCount}件`:''}`;return}
  if(state.usingCache){e.textContent='キャッシュ表示';return}
  e.textContent=state.session?(state.queueCount?`同期待ち ${state.queueCount}件`:'同期済み'):'ログイン待ち';
}

const DB_NAME='ytmCrewLedger';
const DB_VERSION=2;
let idbPromise;
function openLocalDB(){
  if(idbPromise)return idbPromise;
  idbPromise=new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'key'});
      if(!db.objectStoreNames.contains('queue'))db.createObjectStore('queue',{keyPath:'qid'});
    };
    req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);
  });
  return idbPromise;
}
async function idbTx(store,mode,fn){
  const db=await openLocalDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(store,mode),os=tx.objectStore(store);
    let result;
    try{result=fn(os)}catch(e){reject(e);return}
    tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
}
async function saveSnapshot(){
  const data={partners:state.partners,attendance:state.attendance,documents:state.documents,workers:state.workers,photos:state.photos,saved_at:new Date().toISOString()};
  await idbTx('meta','readwrite',os=>os.put({key:'snapshot',data}));
}
async function loadSnapshot(){
  const db=await openLocalDB();
  const row=await new Promise((resolve,reject)=>{
    const tx=db.transaction('meta','readonly'),r=tx.objectStore('meta').get('snapshot');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
  if(!row?.data)return false;
  Object.assign(state,row.data);state.usingCache=true;return true;
}
async function queueAll(){
  const db=await openLocalDB();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('queue','readonly'),r=tx.objectStore('queue').getAll();
    r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);
  });
}
async function enqueue(kind,payload){
  const item={qid:crypto.randomUUID(),kind,payload,created_at:new Date().toISOString()};
  await idbTx('queue','readwrite',os=>os.put(item));
  state.queueCount=(await queueAll()).length;syncPill();return item;
}
async function dequeue(qid){
  await idbTx('queue','readwrite',os=>os.delete(qid));
  state.queueCount=(await queueAll()).length;syncPill();
}

async function fetchAttendanceAll(){
  const all=[];const size=1000;
  for(let from=0;;from+=size){
    const {data,error}=await sb.from('attendance').select('*').order('work_date',{ascending:false}).range(from,from+size-1);
    if(error)throw error;all.push(...(data||[]));if((data||[]).length<size)break;
  }
  return all;
}
async function loadAll(){
  if(!state.session){
    await loadSnapshot().catch(()=>false);render();return;
  }
  try{
    const [p,a,d,w,ph]=await Promise.all([
      sb.from('partners').select('*').order('display_name'),
      fetchAttendanceAll(),
      sb.from('documents').select('*').order('expires_on',{ascending:true,nullsFirst:false}),
      sb.from('worker_profiles').select('*'),
      sb.from('profile_photos').select('*')
    ]);
    const err=[p,d,w,ph].find(x=>x.error)?.error;if(err)throw err;
    state.partners=p.data||[];state.attendance=a||[];state.documents=d.data||[];state.workers=w.data||[];state.photos=ph.data||[];
    state.usingCache=false;await saveSnapshot();syncPill();render();
  }catch(err){
    const cached=await loadSnapshot().catch(()=>false);
    toast(cached?'通信できないため端末保存データを表示します':'同期エラー: '+err.message);
    syncPill();render();
  }
}
function partner(id){return state.partners.find(x=>x.id===id)}
function worker(id){return state.workers.find(x=>x.partner_id===id)}
function photo(id){return state.photos.find(x=>x.partner_id===id)}
async function signed(path){if(!path||!state.online||!state.session)return null;const {data}=await sb.storage.from(C.storageBucket).createSignedUrl(path,3600);return data?.signedUrl||null}
function daysTo(d){
  if(!d)return null;const [y,m,day]=d.split('-').map(Number);const a=new Date();a.setHours(0,0,0,0);const b=new Date(y,m-1,day);return Math.round((b-a)/86400000);
}
function expiryKind(d,required=true){
  if(!required)return ['期限なし','ok'];
  if(!d)return ['未登録',''];
  const days=daysTo(d);
  if(days<0)return ['期限切れ','danger'];
  if(days<=7)return [`残り${days}日`,'warn'];
  if(days<=30)return [`残り${days}日`,'notice'];
  return ['有効','ok'];
}
function activeAttendance(rows=state.attendance){return rows.filter(x=>!x.voided_at)}
function monthRows(){const m=today().slice(0,7);return activeAttendance().filter(x=>x.work_date?.startsWith(m))}
function alerts(){return state.documents.map(d=>{const [text,kind]=expiryKind(d.expires_on,d.expiry_required);return {...d,_text:text,_kind:kind}}).filter(d=>['danger','warn','notice'].includes(d._kind)||(!d.expires_on&&d.expiry_required))}

function home(){
  setTitle('HOME');
  const m=monthRows(),sum=m.reduce((a,x)=>a+Number(x.total_amount||0),0),man=m.reduce((a,x)=>a+Number(x.man_days||0),0),al=alerts();
  return `<div class="hero"><div class="hero-card"><div class="eyebrow">YTM CREW LEDGER</div><h2>人・出面・期限を、<br>ここだけで管理。</h2><p>PCとiPhoneで同じ正本データを使用。通信断では端末へ退避し、復旧後に再送します。</p><div class="hero-actions"><button class="btn primary" id="quickAttend">出面を追加</button><button class="btn blue" id="quickPartner">新規登録</button></div></div><div class="hero-card"><div class="eyebrow">現在の状態</div><h2>${state.online?(state.session?'同期可能':'ログインしてください'):'オフライン'}</h2><p>${state.queueCount?`未送信 ${state.queueCount}件を保持中。通信復旧時に再送します。`:state.usingCache?'端末保存データを表示中です。':'未送信データはありません。'}</p></div></div>
  <div class="metric-grid"><div class="card metric"><div class="label">登録者</div><div class="value">${state.partners.length}</div></div><div class="card metric"><div class="label">今月の人工</div><div class="value">${man.toFixed(1)}</div></div><div class="card metric"><div class="label">今月支払予定</div><div class="value">${yen(sum)}</div></div><div class="card metric"><div class="label">期限要対応</div><div class="value">${al.length}</div></div></div>`;
}

function attendancePage(){
  setTitle('出面入力','DAILY ATTENDANCE');
  const opts=state.partners.filter(p=>p.status==='有効').map(p=>`<option value="${p.id}">${esc(p.display_name)}</option>`).join('');
  return `<div class="card"><div class="section-head"><div><h2>出面を追加</h2><p>登録時点の単価を固定保存します。</p></div></div><form id="attendanceForm" class="form-grid">
  <label>日付<input name="work_date" type="date" value="${today()}" required></label><label>人物<select name="partner_id" required><option value="">選択</option>${opts}</select></label>
  <label class="full">現場名<input name="site_name" required placeholder="現場名"></label><label>作業内容<input name="work_description" placeholder="例：塗装作業"></label>
  <label>人工<input name="man_days" type="number" step="0.25" min="0.25" value="1" required></label><label>適用単価（税込）<input name="applied_daily_rate" type="number" min="0" required></label>
  <label>経費<input name="expense" type="number" min="0" value="0"></label><label class="full">備考<textarea name="notes"></textarea></label>
  <div class="full form-actions"><button class="btn primary">登録する</button></div></form></div>
  <div class="section-head"><div><h2>最近の出面</h2><p>取消は削除せず履歴として残します。</p></div></div>${attendanceTable(state.attendance.slice(0,80),true)}`;
}
function attendanceTable(rows,actions=false){
  if(!rows.length)return `<div class="card empty">まだ出面がありません。</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>日付</th><th>氏名</th><th>現場</th><th>人工</th><th>単価</th><th>経費</th><th>支払額</th><th>状態</th>${actions?'<th></th>':''}</tr></thead><tbody>${rows.map(x=>`<tr class="${x.voided_at?'is-voided':''}"><td>${fmt(x.work_date)}</td><td class="name-cell">${esc(partner(x.partner_id)?.display_name||'')}</td><td>${esc(x.site_name)}</td><td>${x.man_days}</td><td>${yen(x.applied_daily_rate)}</td><td>${yen(x.expense)}</td><td><b>${yen(x.total_amount)}</b></td><td>${x.voided_at?badge('取消','danger'):badge('有効','ok')}</td>${actions?`<td><button class="btn mini ghost" data-attendance-action="${x.voided_at?'restore':'void'}" data-id="${x.id}">${x.voided_at?'復旧':'取消'}</button></td>`:''}</tr>`).join('')}</tbody></table></div>`;
}

function partnersPage(){
  setTitle('協力会社','PARTNERS');
  return `<div class="section-head"><div><h2>登録者</h2><p>${state.partners.length}件</p></div><button class="btn primary" id="addPartner">新規登録</button></div>
  <div class="card compact"><label>検索<input id="partnerSearch" placeholder="氏名・会社名・電話番号・住所"></label></div>
  <div id="personGrid" class="person-grid">${state.partners.map(p=>`<div class="person-card" data-id="${p.id}" data-search="${esc([p.display_name,p.full_name,p.company_name,p.trade_name,p.phone,p.address].filter(Boolean).join(' ').toLowerCase())}"><div class="avatar" data-photo="${p.id}">${esc((p.display_name||'?').slice(0,1))}</div><div><h3>${esc(p.display_name)}</h3><p>${esc(p.full_name)}<br>${yen(p.payment_daily_rate)} / 人工　${badge(p.verification_state||'申告',(p.verification_state==='矛盾'||p.verification_state==='未確認')?'warn':'')}</p></div></div>`).join('')||'<div class="card empty">登録者はいません。</div>'}</div>`;
}
function partnerForm(p={}){
  return `<div class="card"><div class="section-head"><div><h2>${p.id?'登録情報を編集':'新規登録'}</h2><p>証明書は登録後に追加します。</p></div></div><form id="partnerForm" class="form-grid"><input type="hidden" name="id" value="${p.id||''}">
  <label>登録区分<select name="registration_type" required><option>法人</option><option>個人事業主・一人親方</option><option>個人応援・屋号なし</option></select></label><label>氏名<input name="full_name" value="${esc(p.full_name||'')}" required></label>
  <label>会社名<input name="company_name" value="${esc(p.company_name||'')}"></label><label>屋号<input name="trade_name" value="${esc(p.trade_name||'')}"></label><label>代表者名<input name="representative_name" value="${esc(p.representative_name||'')}"></label><label>電話番号<input name="phone" value="${esc(p.phone||'')}" required inputmode="tel"></label>
  <label class="full">住所<input name="address" value="${esc(p.address||'')}"></label><label>通常人工単価（税込）<input name="base_daily_rate" type="number" min="0" value="${p.base_daily_rate??''}" required></label>
  <label>インボイス<select name="invoice_status"><option>要確認</option><option>あり</option><option>なし</option></select></label><label>インボイス番号<input name="invoice_number" value="${esc(p.invoice_number||'')}"></label>
  <label>生年月日<input name="birth_date" type="date" value="${p.birth_date||''}"></label><label>情報状態<select name="verification_state">${VERIFICATION_STATES.map(s=>`<option>${s}</option>`).join('')}</select></label>
  <label class="full">確認根拠・未確認内容<input name="verification_note" value="${esc(p.verification_note||'')}" placeholder="例：本人申告／免許証で確認／要再確認"></label>
  <label>連絡方法<div class="seg"><button type="button" data-toggle="line" class="${p.contact_line?'active':''}">LINE</button><button type="button" data-toggle="email" class="${p.contact_email?'active':''}">メール</button></div><input type="hidden" name="contact_line" value="${p.contact_line?'1':'0'}"><input type="hidden" name="contact_email" value="${p.contact_email?'1':'0'}"></label>
  <label>銀行名<input name="bank_name" value="${esc(p.bank_name||'')}"></label><label>支店名<input name="branch_name" value="${esc(p.branch_name||'')}"></label><label>口座種別<select name="account_type"><option value=""></option><option>普通</option><option>当座</option><option>その他</option></select></label>
  <label>口座番号<input name="account_number" value="${esc(p.account_number||'')}"></label><label>口座名義<input name="account_holder" value="${esc(p.account_holder||'')}"></label><label class="full">備考<textarea name="notes">${esc(p.notes||'')}</textarea></label>
  <div class="full form-actions"><button type="button" class="btn ghost" id="cancelPartner">戻る</button><button class="btn primary">${p.id?'更新する':'登録する'}</button></div></form></div>`;
}

async function profilePage(id){
  const p=partner(id);if(!p){go('partners');return ''}
  setTitle(p.display_name,'PROFILE');
  const docs=state.documents.filter(x=>x.partner_id===id),rows=state.attendance.filter(x=>x.partner_id===id);
  return `<div class="card profile-head"><div class="profile-photo" id="profilePhoto">${esc((p.display_name||'?').slice(0,1))}</div><div><div class="eyebrow">${esc(p.registration_type)}</div><h2>${esc(p.display_name)}</h2><p>${esc(p.full_name)}　${esc(p.phone)}</p><p>支払単価 ${yen(p.payment_daily_rate)} / 人工　${badge(p.verification_state||'申告')}</p></div><button class="btn ghost" id="editPartner">登録情報を編集</button></div>
  <div class="metric-grid"><div class="card metric"><div class="label">今月人工</div><div class="value">${activeAttendance(rows).filter(x=>x.work_date?.startsWith(today().slice(0,7))).reduce((a,x)=>a+Number(x.man_days),0).toFixed(1)}</div></div><div class="card metric"><div class="label">今月支払</div><div class="value">${yen(activeAttendance(rows).filter(x=>x.work_date?.startsWith(today().slice(0,7))).reduce((a,x)=>a+Number(x.total_amount),0))}</div></div><div class="card metric"><div class="label">証明書</div><div class="value">${docs.length}</div></div><div class="card metric"><div class="label">要対応</div><div class="value">${docs.filter(d=>['danger','warn','notice'].includes(expiryKind(d.expires_on,d.expiry_required)[1])).length}</div></div></div>
  <div class="grid-2"><div class="card"><div class="section-head"><div><h2>顔写真</h2><p>JPG / PNG / WEBP</p></div></div><input type="file" id="photoFile" accept="image/jpeg,image/png,image/webp"><div class="form-actions"><button class="btn blue" id="uploadPhoto">写真を登録</button></div></div>
  <div class="card"><div class="section-head"><div><h2>証明書を追加</h2><p>通信断では端末へ保持して後送信します。</p></div></div><form id="docForm" class="form-grid"><label>書類種別<select name="document_type"><option>労災関係</option><option>車検証</option><option>任意保険</option><option>自賠責</option><option>資格証</option><option>免許証</option><option>特別教育</option><option>技能講習</option><option>健康診断</option><option>その他</option></select></label><label>有効期限<input name="expires_on" type="date"></label><label>読取状態<select name="read_status"><option>確定</option><option>未確認</option><option>読取不能</option><option>要確認</option></select></label><label>ファイル<input name="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label><div class="full form-actions"><button class="btn primary">追加</button></div></form></div></div>
  <div class="section-head"><div><h2>証明書・期限</h2></div></div>${docsTable(docs)}<div class="section-head"><div><h2>出面履歴</h2></div></div>${attendanceTable(rows.slice(0,120),false)}`;
}
function docsTable(docs){
  if(!docs.length)return `<div class="card empty">証明書はまだ登録されていません。</div>`;
  return `<div class="table-wrap"><table><thead><tr><th>書類</th><th>期限</th><th>状態</th><th>読取</th></tr></thead><tbody>${docs.map(d=>{const [t,k]=expiryKind(d.expires_on,d.expiry_required);return `<tr><td class="name-cell">${esc(d.document_type)}</td><td>${fmt(d.expires_on)||'未登録'}</td><td>${badge(t,k)}</td><td>${badge(d.read_status,d.read_status==='確定'?'ok':d.read_status==='要確認'?'warn':'')}</td></tr>`}).join('')}</tbody></table></div>`;
}
function alertsPage(){
  setTitle('期限アラート','DOCUMENT CONTROL');const a=alerts();
  return `<div class="metric-grid"><div class="card metric"><div class="label">期限切れ</div><div class="value">${a.filter(x=>x._kind==='danger').length}</div></div><div class="card metric"><div class="label">7日以内</div><div class="value">${a.filter(x=>x._kind==='warn').length}</div></div><div class="card metric"><div class="label">8〜30日</div><div class="value">${a.filter(x=>x._kind==='notice').length}</div></div><div class="card metric"><div class="label">期限未登録</div><div class="value">${a.filter(x=>!x.expires_on).length}</div></div></div>
  <div class="section-head"><div><h2>要対応一覧</h2><p>赤→7日以内→30日以内の順に確認します。</p></div></div><div class="alert-list">${a.map(d=>`<div class="alert-row ${d._kind}"><div><b>${esc(partner(d.partner_id)?.display_name||'')}</b><div class="muted">${esc(d.document_type)} ・ ${fmt(d.expires_on)||'期限未登録'}</div></div>${badge(d._text,d._kind)}</div>`).join('')||'<div class="card empty">現在、期限対応はありません。</div>'}</div>`;
}

function rosterPage(){
  setTitle('作業員情報','WORKER ROSTER');
  return `<div class="card"><div class="section-head"><div><h2>作業員名簿データ</h2><p>第5号系帳票へ出す正本情報です。</p></div></div>${state.partners.length?`<div class="table-wrap"><table><thead><tr><th>氏名</th><th>ふりがな</th><th>職種</th><th>健康保険</th><th>厚生年金</th><th>雇用保険</th><th>状態</th><th></th></tr></thead><tbody>${state.partners.map(p=>{const w=worker(p.id)||{};return `<tr><td class="name-cell">${esc(p.full_name)}</td><td>${esc(w.furigana||'未登録')}</td><td>${esc(w.occupation||'未登録')}</td><td>${esc(w.health_insurance||'未登録')}</td><td>${esc(w.pension||'未登録')}</td><td>${esc(w.employment_insurance||'未登録')}</td><td>${badge(w.verification_state||'未確認',(w.verification_state==='未確認'||w.verification_state==='矛盾')?'warn':'')}</td><td><button class="btn mini ghost" data-worker="${p.id}">編集</button></td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">登録者がいません。</div>'}</div>`;
}
function workerForm(partnerId){
  const p=partner(partnerId),w=worker(partnerId)||{};
  if(!p)return '<div class="card empty">対象者が見つかりません。</div>';
  setTitle(`${p.display_name}・作業員情報`,'WORKER ROSTER');
  const fields=[['furigana','ふりがな'],['occupation','職種'],['hire_date','雇入年月日','date'],['experience_years','経験年数','number'],['health_insurance','健康保険'],['pension','厚生年金'],['employment_insurance','雇用保険'],['retirement_mutual_aid','退職金共済'],['ccus_business_id','CCUS事業者ID'],['ccus_skill_worker_id','CCUS技能者ID'],['emergency_contact','緊急連絡先'],['last_health_check_date','最近の健康診断日','date']];
  return `<div class="card"><form id="workerForm" class="form-grid"><input type="hidden" name="partner_id" value="${partnerId}">${fields.map(([n,l,t='text'])=>`<label>${l}<input name="${n}" type="${t}" value="${esc(w[n]??'')}"></label>`).join('')}<label>情報状態<select name="verification_state">${VERIFICATION_STATES.map(s=>`<option>${s}</option>`).join('')}</select></label><label class="full">確認根拠・未確認内容<input name="verification_note" value="${esc(w.verification_note||'')}"></label><div class="full form-actions"><button type="button" class="btn ghost" id="cancelWorker">戻る</button><button class="btn primary">保存</button></div></form></div>`;
}

function auditIssues(){
  const issues=[];
  state.partners.forEach(p=>{
    if(p.invoice_status==='要確認')issues.push(`${p.display_name}: インボイス状態が要確認`);
    if(p.invoice_status==='あり'&&!p.invoice_number)issues.push(`${p.display_name}: インボイス番号なし`);
    if(['未確認','矛盾','推定'].includes(p.verification_state))issues.push(`${p.display_name}: 基本情報状態 ${p.verification_state}`);
  });
  state.workers.forEach(w=>{if(['未確認','矛盾','推定'].includes(w.verification_state))issues.push(`${partner(w.partner_id)?.display_name||''}: 作業員情報 ${w.verification_state}`)});
  state.documents.forEach(d=>{if(d.read_status!=='確定')issues.push(`${partner(d.partner_id)?.display_name||''}: ${d.document_type} が${d.read_status}`)});
  if(state.queueCount)issues.push(`未送信データ ${state.queueCount}件`);
  return issues;
}
function auditPage(){
  setTitle('監査','INTERNAL AUDIT');const issues=auditIssues();
  return `<div class="hero"><div class="hero-card"><div class="eyebrow">AUDIT RESULT</div><h2>${issues.length?'要確認 '+issues.length+'件':'監査異常なし'}</h2><p>推測で埋めず、未確認情報を明示します。</p></div><div class="hero-card"><div class="eyebrow">RECOVERY</div><h2>${state.queueCount?`未送信 ${state.queueCount}件`:'未送信 0件'}</h2><p>通信復旧時に再送。送信完了まで端末から消しません。</p></div></div>
  <div class="section-head"><div><h2>要確認</h2></div><div class="hero-actions"><button class="btn ghost" id="retryQueue">未送信を再送</button><button class="btn blue" id="backupJson">バックアップ出力</button></div></div>
  <div class="alert-list">${issues.map(x=>`<div class="alert-row info"><div>${esc(x)}</div>${badge('要確認','warn')}</div>`).join('')||'<div class="card empty">現在、要確認項目はありません。</div>'}</div>`;
}

function render(){
  syncPill();let html='';
  if(state.page==='home')html=home();
  else if(state.page==='attendance')html=attendancePage();
  else if(state.page==='partners')html=state.selected?.startsWith?.('new')?partnerForm():partnersPage();
  else if(state.page==='partner-edit')html=partnerForm(partner(state.selected));
  else if(state.page==='profile'){profilePage(state.selected).then(h=>{$('#content').innerHTML=h;bind();hydratePhotos()});return}
  else if(state.page==='alerts')html=alertsPage();
  else if(state.page==='roster')html=rosterPage();
  else if(state.page==='worker-edit')html=workerForm(state.selected);
  else html=auditPage();
  $('#content').innerHTML=html;bind();hydratePhotos();
}
function formObj(f){return Object.fromEntries(new FormData(f).entries())}
function displayName(d){if(d.registration_type==='法人')return d.company_name?.trim()||d.full_name;if(d.registration_type==='個人事業主・一人親方')return d.trade_name?.trim()||d.full_name;return d.full_name}
function normalizeNullable(d,keys){keys.forEach(k=>{if(d[k]==='')d[k]=null})}
function replaceById(arr,row){const i=arr.findIndex(x=>x.id===row.id);if(i>=0)arr[i]={...arr[i],...row};else arr.push(row)}
async function optimistic(kind,row){
  if(kind==='partner_upsert')replaceById(state.partners,row);
  if(kind==='attendance_upsert')replaceById(state.attendance,row);
  if(kind==='attendance_patch'){const x=state.attendance.find(a=>a.id===row.id);if(x)Object.assign(x,row.patch)}
  if(kind==='worker_upsert'){const i=state.workers.findIndex(x=>x.partner_id===row.partner_id);if(i>=0)state.workers[i]={...state.workers[i],...row};else state.workers.push(row)}
  if(kind==='document_upsert')replaceById(state.documents,row);
  if(kind==='photo_upsert'){const i=state.photos.findIndex(x=>x.partner_id===row.partner_id);if(i>=0)state.photos[i]={...state.photos[i],...row};else state.photos.push(row)}
  await saveSnapshot();
}
async function uploadBlob(blob,name,type,folder){
  const ext=(name?.split('.').pop()||'bin').toLowerCase(),uid=state.session.user.id;
  const path=`${uid}/${folder}/${crypto.randomUUID()}.${ext}`;
  const r=await sb.storage.from(C.storageBucket).upload(path,blob,{upsert:false,contentType:type||'application/octet-stream'});
  if(r.error)throw r.error;return path;
}
async function runQueueItem(item){
  const p=item.payload;
  if(item.kind==='partner_upsert'){const r=await sb.from('partners').upsert(p).select().single();if(r.error)throw r.error;return}
  if(item.kind==='attendance_upsert'){const r=await sb.from('attendance').upsert(p).select().single();if(r.error)throw r.error;return}
  if(item.kind==='attendance_patch'){const r=await sb.from('attendance').update(p.patch).eq('id',p.id);if(r.error)throw r.error;return}
  if(item.kind==='worker_upsert'){const r=await sb.from('worker_profiles').upsert(p,{onConflict:'partner_id'}).select().single();if(r.error)throw r.error;return}
  if(item.kind==='document_upsert'){
    const row={...p.row};let uploaded=null;
    if(p.file && !row.storage_path){uploaded=await uploadBlob(p.file,p.fileName,p.fileType,`documents/${row.partner_id}`);row.storage_path=uploaded}
    const r=await sb.from('documents').upsert(row).select().single();
    if(r.error){if(uploaded)await sb.storage.from(C.storageBucket).remove([uploaded]);throw r.error}
    return;
  }
  if(item.kind==='photo_upsert'){
    const row={...p.row};const old=photo(row.partner_id)?.storage_path;let uploaded=null;
    if(p.file){uploaded=await uploadBlob(p.file,p.fileName,p.fileType,`photos/${row.partner_id}`);row.storage_path=uploaded}
    const r=await sb.from('profile_photos').upsert(row,{onConflict:'partner_id'}).select().single();
    if(r.error){if(uploaded)await sb.storage.from(C.storageBucket).remove([uploaded]);throw r.error}
    if(old&&uploaded&&old!==uploaded)await sb.storage.from(C.storageBucket).remove([old]);
  }
}
async function submitOrQueue(kind,payload,optimisticRow){
  if(optimisticRow)await optimistic(kind,optimisticRow);
  if(!state.online||!state.session){await enqueue(kind,payload);toast('オフラインのため端末に保存しました');render();return {queued:true}}
  try{await runQueueItem({kind,payload});await loadAll();return {queued:false}}
  catch(e){await enqueue(kind,payload);toast('送信できないため端末に保持しました');render();return {queued:true,error:e}}
}
async function flushQueue(){
  if(!state.online||!state.session)return;
  const items=(await queueAll()).sort((a,b)=>a.created_at.localeCompare(b.created_at));
  for(const item of items){
    try{await runQueueItem(item);await dequeue(item.qid)}
    catch(e){toast('未送信データの再送を停止しました: '+e.message);break}
  }
  await loadAll();
}

async function savePartner(f){
  if(!state.session&&!state.online)return toast('初回登録前に一度ログインしてください');
  const btn=f.querySelector('button[type="submit"]');if(btn?.disabled)return;if(btn)btn.disabled=true;
  try{
    const d=formObj(f);d.contact_line=f.elements.contact_line.value==='1';d.contact_email=f.elements.contact_email.value==='1';d.base_daily_rate=Number(d.base_daily_rate);d.display_name=displayName(d);
    normalizeNullable(d,['company_name','trade_name','representative_name','address','invoice_number','birth_date','bank_name','branch_name','account_type','account_number','account_holder','notes','verification_note']);
    const id=d.id||crypto.randomUUID();delete d.id;d.id=id;
    if(d.invoice_status==='あり'&&!d.invoice_number)return toast('インボイス番号を入力してください');
    if(!partner(id)){
      const dup=state.partners.find(p=>(p.phone&&d.phone&&p.phone===d.phone)||(p.full_name===d.full_name&&p.display_name===d.display_name));
      if(dup&&!confirm(`${dup.display_name} と重複する可能性があります。それでも登録しますか？`))return;
    }
    await submitOrQueue('partner_upsert',d,d);toast(partner(id)?'更新しました':'登録しました');state.selected=null;state.page='partners';renderNav();render();
  }finally{if(btn)btn.disabled=false}
}
async function saveAttendance(f){
  const btn=f.querySelector('button[type="submit"]');if(btn?.disabled)return;if(btn)btn.disabled=true;
  try{
    const d=formObj(f),p=partner(d.partner_id);if(!p)return toast('人物を選択してください');
    const row={id:crypto.randomUUID(),partner_id:d.partner_id,work_date:d.work_date,site_name:d.site_name.trim(),work_description:d.work_description||null,man_days:Number(d.man_days),source_base_daily_rate:p.base_daily_rate,source_invoice_status:p.invoice_status,applied_daily_rate:Number(d.applied_daily_rate),expense:Number(d.expense||0),notes:d.notes||null,source:'PWA'};
    await submitOrQueue('attendance_upsert',row,row);toast('出面を登録しました');
  }finally{if(btn)btn.disabled=false}
}
async function attendanceAction(id,action){
  const patch=action==='void'?{voided_at:new Date().toISOString(),void_reason:'入力取消',voided_by:state.session?.user?.id||null}:{voided_at:null,void_reason:null,voided_by:null};
  await submitOrQueue('attendance_patch',{id,patch},{id,patch});toast(action==='void'?'出面を取消しました':'出面を復旧しました');
}
async function saveWorker(f){
  const d=formObj(f);normalizeNullable(d,['furigana','occupation','hire_date','experience_years','health_insurance','pension','employment_insurance','retirement_mutual_aid','ccus_business_id','ccus_skill_worker_id','emergency_contact','last_health_check_date','verification_note']);
  if(d.experience_years!==null)d.experience_years=Number(d.experience_years);
  const old=worker(d.partner_id);d.id=old?.id||crypto.randomUUID();
  await submitOrQueue('worker_upsert',d,d);toast('作業員情報を保存しました');go('roster');
}
async function saveDoc(f){
  const d=formObj(f),file=f.elements.file.files[0],row={id:crypto.randomUUID(),partner_id:state.selected,document_type:d.document_type,expires_on:d.expires_on||null,read_status:d.read_status,storage_path:null,mime_type:file?.type||null,original_filename:file?.name||null,expiry_required:true};
  await optimistic('document_upsert',row);
  const payload={row,file:file||null,fileName:file?.name||null,fileType:file?.type||null};
  if(!state.online||!state.session){await enqueue('document_upsert',payload);toast('証明書を端末に保存しました');render();return}
  try{await runQueueItem({kind:'document_upsert',payload});toast('証明書を追加しました');await loadAll()}catch(e){await enqueue('document_upsert',payload);toast('送信できないため証明書を端末に保持しました');render()}
}
async function uploadPhoto(){
  const file=$('#photoFile')?.files[0];if(!file)return toast('写真を選択してください');
  const old=photo(state.selected),row={id:old?.id||crypto.randomUUID(),partner_id:state.selected,storage_path:old?.storage_path||null,mime_type:file.type,original_filename:file.name};
  const payload={row,file,fileName:file.name,fileType:file.type};
  await optimistic('photo_upsert',row);
  if(!state.online||!state.session){await enqueue('photo_upsert',payload);toast('写真を端末に保存しました');render();return}
  try{await runQueueItem({kind:'photo_upsert',payload});toast('顔写真を登録しました');await loadAll()}catch(e){await enqueue('photo_upsert',payload);toast('送信できないため写真を端末に保持しました');render()}
}

function downloadBackup(){
  const payload={schema:'YTM-CREW-BACKUP-1',exported_at:new Date().toISOString(),partners:state.partners,attendance:state.attendance,documents:state.documents,worker_profiles:state.workers,profile_photos:state.photos};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`YTM_協力会社出面バックアップ_${today().replaceAll('-','')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function bind(){
  $('#quickAttend')?.addEventListener('click',()=>go('attendance'));$('#quickPartner')?.addEventListener('click',()=>{state.page='partners';state.selected='new';renderNav();render()});$('#addPartner')?.addEventListener('click',()=>{state.selected='new';render()});$('#cancelPartner')?.addEventListener('click',()=>go('partners'));$('#editPartner')?.addEventListener('click',()=>{state.page='partner-edit';renderNav();render()});
  $('#personGrid')?.querySelectorAll('.person-card').forEach(x=>x.onclick=()=>go('profile',x.dataset.id));
  $('#partnerSearch')?.addEventListener('input',e=>{const q=e.target.value.trim().toLowerCase();$('#personGrid')?.querySelectorAll('.person-card').forEach(c=>c.hidden=q&&!c.dataset.search.includes(q))});
  $('#partnerForm')?.addEventListener('submit',e=>{e.preventDefault();savePartner(e.currentTarget)});$('#attendanceForm')?.addEventListener('submit',e=>{e.preventDefault();saveAttendance(e.currentTarget)});
  $('#docForm')?.addEventListener('submit',e=>{e.preventDefault();saveDoc(e.currentTarget)});$('#uploadPhoto')?.addEventListener('click',uploadPhoto);
  document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>{b.classList.toggle('active');const n=b.dataset.toggle;const i=document.querySelector(`[name="contact_${n}"]`);i.value=b.classList.contains('active')?'1':'0'});
  const pf=$('#partnerForm');if(pf){const p=partner(pf.elements.id.value)||{};pf.elements.registration_type.value=p.registration_type||'個人事業主・一人親方';pf.elements.invoice_status.value=p.invoice_status||'要確認';pf.elements.account_type.value=p.account_type||'';pf.elements.verification_state.value=p.verification_state||'申告'}
  const af=$('#attendanceForm');af?.elements.partner_id.addEventListener('change',e=>{const p=partner(e.target.value);af.elements.applied_daily_rate.value=p?.payment_daily_rate??''});
  document.querySelectorAll('[data-attendance-action]').forEach(b=>b.onclick=()=>attendanceAction(b.dataset.id,b.dataset.attendanceAction));
  document.querySelectorAll('[data-worker]').forEach(b=>b.onclick=()=>go('worker-edit',b.dataset.worker));
  $('#cancelWorker')?.addEventListener('click',()=>go('roster'));$('#workerForm')?.addEventListener('submit',e=>{e.preventDefault();saveWorker(e.currentTarget)});
  const wf=$('#workerForm');if(wf){const w=worker(wf.elements.partner_id.value)||{};wf.elements.verification_state.value=w.verification_state||'未確認'}
  $('#retryQueue')?.addEventListener('click',flushQueue);$('#backupJson')?.addEventListener('click',downloadBackup);
}
async function hydratePhotos(){
  if(!state.online||!state.session)return;
  for(const el of document.querySelectorAll('[data-photo]')){const ph=photo(el.dataset.photo);if(ph?.storage_path){const u=await signed(ph.storage_path);if(u)el.outerHTML=`<img class="avatar" src="${u}" alt="顔写真">`}}
  if(state.page==='profile'){const ph=photo(state.selected);if(ph?.storage_path){const u=await signed(ph.storage_path);if(u){const el=$('#profilePhoto');if(el)el.outerHTML=`<img id="profilePhoto" class="profile-photo" src="${u}" alt="顔写真">`}}}
}

const AUTH_EMAIL='kcfnk1001@icloud.com';
const modal=$('#modal');
$('#loginBtn').onclick=()=>{const input=$('#authEmail');if(input)input.value=AUTH_EMAIL;modal.showModal()};
$('#doLoginBtn').onclick=async()=>{
  const btn=$('#doLoginBtn');btn.disabled=true;$('#authMessage').textContent='ログインリンクを送信しています…';
  const redirectTo=window.location.origin+window.location.pathname;
  const {error}=await sb.auth.signInWithOtp({email:AUTH_EMAIL,options:{shouldCreateUser:true,emailRedirectTo:redirectTo}});
  $('#authMessage').textContent=error?`送信できませんでした: ${error.message}`:'iCloudメールへログインリンクを送りました。メールの「ログイン」を押してください。';btn.disabled=false
};
$('#logoutBtn').onclick=async()=>{await sb.auth.signOut();state.session=null;modal.close();render()};
async function initSession(){
  state.queueCount=(await queueAll().catch(()=>[])).length;
  const {data}=await sb.auth.getSession();state.session=data.session;
  if(state.session&&state.online){await flushQueue()}else{await loadAll()}
}
sb.auth.onAuthStateChange(async(_event,session)=>{state.session=session;if(session&&state.online)await flushQueue();else render()});
window.addEventListener('online',async()=>{state.online=true;syncPill();if(state.session)await flushQueue();else await loadAll()});
window.addEventListener('offline',async()=>{state.online=false;await saveSnapshot().catch(()=>{});syncPill();render()});
let deferred;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;$('#installBtn').classList.remove('hidden')});
$('#installBtn').onclick=async()=>{if(deferred){deferred.prompt();await deferred.userChoice;deferred=null;$('#installBtn').classList.add('hidden')}};
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
renderNav();initSession();
