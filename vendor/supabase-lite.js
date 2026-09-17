const SESSION_KEY='ytmCrewSessionV1';

function decodeJwt(token){
  try{
    const part=token.split('.')[1];
    const base=part.replace(/-/g,'+').replace(/_/g,'/');
    const json=decodeURIComponent(atob(base).split('').map(c=>'%'+c.charCodeAt(0).toString(16).padStart(2,'0')).join(''));
    return JSON.parse(json);
  }catch{return {}}
}
function authError(data,status){
  const e=new Error(data?.msg||data?.message||data?.error_description||data?.error||`HTTP ${status}`);
  e.status=status;e.code=data?.code||null;e.details=data?.details||null;return e;
}
async function parseResponse(r){
  if(r.status===204)return null;
  const text=await r.text();
  if(!text)return null;
  try{return JSON.parse(text)}catch{return text}
}

class AuthLite{
  constructor(url,key){this.url=url;this.key=key;this.listeners=new Set()}
  _store(session){
    if(session)localStorage.setItem(SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(SESSION_KEY);
    this.listeners.forEach(fn=>{try{fn(session?'SIGNED_IN':'SIGNED_OUT',session)}catch{}});
  }
  _normalize(tokens){
    if(!tokens?.access_token)return null;
    const claims=decodeJwt(tokens.access_token);
    return {
      access_token:tokens.access_token,
      refresh_token:tokens.refresh_token||'',
      token_type:tokens.token_type||'bearer',
      expires_in:Number(tokens.expires_in||3600),
      expires_at:Number(tokens.expires_at||claims.exp||Math.floor(Date.now()/1000)+Number(tokens.expires_in||3600)),
      user:tokens.user||{id:claims.sub,email:claims.email||''}
    };
  }
  _read(){
    try{return JSON.parse(localStorage.getItem(SESSION_KEY)||'null')}catch{return null}
  }
  _fromUrl(){
    if(!location.hash.includes('access_token='))return null;
    const p=new URLSearchParams(location.hash.slice(1));
    const s=this._normalize({
      access_token:p.get('access_token'),refresh_token:p.get('refresh_token'),token_type:p.get('token_type'),expires_in:p.get('expires_in')
    });
    if(s){this._store(s);history.replaceState(null,'',location.pathname+location.search)}
    return s;
  }
  async _refresh(session){
    if(!session?.refresh_token)return null;
    const r=await fetch(`${this.url}/auth/v1/token?grant_type=refresh_token`,{
      method:'POST',headers:{apikey:this.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:session.refresh_token})
    });
    const data=await parseResponse(r);
    if(!r.ok)throw authError(data,r.status);
    const next=this._normalize(data);this._store(next);return next;
  }
  async _validSession(force=false){
    let s=this._fromUrl()||this._read();
    if(!s)return null;
    const now=Math.floor(Date.now()/1000);
    if(force||Number(s.expires_at||0)<=now+60){
      try{s=await this._refresh(s)}catch{this._store(null);return null}
    }
    return s;
  }
  async getSession(){return {data:{session:await this._validSession()},error:null}}
  async signInWithOtp({email,options={}}){
    const redirect=options.emailRedirectTo||location.href.split('#')[0];
    const r=await fetch(`${this.url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirect)}`,{
      method:'POST',headers:{apikey:this.key,'Content-Type':'application/json'},
      body:JSON.stringify({email,data:{},create_user:options.shouldCreateUser!==false,gotrue_meta_security:{}})
    });
    const data=await parseResponse(r);
    return r.ok?{data:{user:null,session:null},error:null}:{data:null,error:authError(data,r.status)};
  }
  async signOut(){
    const s=this._read();
    if(s?.access_token){try{await fetch(`${this.url}/auth/v1/logout?scope=local`,{method:'POST',headers:{apikey:this.key,Authorization:`Bearer ${s.access_token}`}})}catch{}}
    this._store(null);return {error:null};
  }
  onAuthStateChange(callback){this.listeners.add(callback);return {data:{subscription:{unsubscribe:()=>this.listeners.delete(callback)}}}}
}

class QueryBuilder{
  constructor(client,table){this.client=client;this.table=table;this.method='GET';this.params=new URLSearchParams();this.body=null;this.prefer=[];this.wantSingle=false;this.wantRepresentation=false;this.rangeValue=null}
  select(cols='*'){this.params.set('select',cols);this.wantRepresentation=true;return this}
  order(column,{ascending=true,nullsFirst}={}){
    let v=`${column}.${ascending?'asc':'desc'}`;
    if(nullsFirst===true)v+='.nullsfirst';if(nullsFirst===false)v+='.nullslast';
    this.params.set('order',v);return this;
  }
  range(from,to){this.rangeValue=[from,to];return this}
  upsert(payload,{onConflict}={}){this.method='POST';this.body=payload;this.prefer.push('resolution=merge-duplicates');if(onConflict)this.params.set('on_conflict',onConflict);return this}
  update(payload){this.method='PATCH';this.body=payload;return this}
  eq(column,value){this.params.set(column,`eq.${value}`);return this}
  single(){this.wantSingle=true;return this}
  then(resolve,reject){return this.execute().then(resolve,reject)}
  async execute(){
    const qs=this.params.toString();const url=`${this.client.url}/rest/v1/${encodeURIComponent(this.table)}${qs?'?'+qs:''}`;
    const headers={'Content-Type':'application/json'};
    if(this.rangeValue){headers['Range-Unit']='items';headers.Range=`${this.rangeValue[0]}-${this.rangeValue[1]}`}
    if(this.method!=='GET'){
      this.prefer.push(this.wantRepresentation?'return=representation':'return=minimal');headers.Prefer=[...new Set(this.prefer)].join(',');
    }
    if(this.wantSingle)headers.Accept='application/vnd.pgrst.object+json';
    const r=await this.client._fetch(url,{method:this.method,headers,body:this.body==null?undefined:JSON.stringify(this.body)});
    const data=await parseResponse(r);
    if(!r.ok)return {data:null,error:authError(data,r.status),status:r.status};
    return {data,error:null,status:r.status};
  }
}

class StorageBucketLite{
  constructor(client,bucket){this.client=client;this.bucket=bucket}
  _path(path){return path.split('/').map(encodeURIComponent).join('/')}
  async upload(path,blob,{upsert=false,contentType}={}){
    const r=await this.client._fetch(`${this.client.url}/storage/v1/object/${encodeURIComponent(this.bucket)}/${this._path(path)}`,{
      method:'POST',headers:{'Content-Type':contentType||blob.type||'application/octet-stream','x-upsert':String(!!upsert)},body:blob
    });
    const data=await parseResponse(r);return r.ok?{data,error:null}:{data:null,error:authError(data,r.status)};
  }
  async remove(paths){
    const r=await this.client._fetch(`${this.client.url}/storage/v1/object/${encodeURIComponent(this.bucket)}`,{
      method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})
    });
    const data=await parseResponse(r);return r.ok?{data,error:null}:{data:null,error:authError(data,r.status)};
  }
  async createSignedUrl(path,expiresIn){
    const r=await this.client._fetch(`${this.client.url}/storage/v1/object/sign/${encodeURIComponent(this.bucket)}/${this._path(path)}`,{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expiresIn})
    });
    const raw=await parseResponse(r);
    if(!r.ok)return {data:null,error:authError(raw,r.status)};
    const signedUrl=raw?.signedURL||raw?.signedUrl||null;
    return {data:{signedUrl:signedUrl?.startsWith('http')?signedUrl:`${this.client.url}/storage/v1${signedUrl||''}`},error:null};
  }
}

class SupabaseLite{
  constructor(url,key){this.url=url.replace(/\/$/,'');this.key=key;this.auth=new AuthLite(this.url,key);this.storage={from:(bucket)=>new StorageBucketLite(this,bucket)}}
  from(table){return new QueryBuilder(this,table)}
  async _fetch(url,init={},retried=false){
    const session=await this.auth._validSession();
    const headers=new Headers(init.headers||{});headers.set('apikey',this.key);if(session?.access_token)headers.set('Authorization',`Bearer ${session.access_token}`);
    const r=await fetch(url,{...init,headers});
    if(r.status===401&&!retried&&session?.refresh_token){
      const refreshed=await this.auth._validSession(true);if(refreshed)return this._fetch(url,init,true);
    }
    return r;
  }
}

export function createClient(url,key){return new SupabaseLite(url,key)}
