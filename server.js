
const express = require('express');
const cors = require('cors');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
const authDir = './auth'; if(!fs.existsSync(authDir)) fs.mkdirSync(authDir);

async function realCheck(phone){
  const clean = phone.replace(/[^0-9]/g,'');
  const {state, saveCreds} = await useMultiFileAuthState(path.join(authDir, clean));
  const sock = makeWASocket({auth: state, logger: pino({level:'silent'}), browser:["APOTHEON","Chrome","1.0"], printQRInTerminal:false});
  return new Promise((resolve)=>{
    let done=false;
    const to = setTimeout(()=>{ if(!done){done=true; resolve({banned:false, status:'timeout', phone:clean, note:'Pas de réponse WA - probablement non banni ou rate limit', isReal:true}); try{sock.end()}catch{}}}, 18000);
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (u)=>{
      const {lastDisconnect, connection} = u;
      if(lastDisconnect?.error){
        const err = lastDisconnect.error;
        const code = err?.output?.statusCode || err?.data?.reason;
        const data = err?.data || err?.output?.payload || {};
        console.log('WA error', code, JSON.stringify(data));
        if(code===401 || data?.reason===401 || String(err.message).includes('401') || code===403){
          if(!done){done=true; clearTimeout(to);
            const ts = data?.ban_time || data?.timestamp || Date.now()/1000;
            const d = new Date(ts*1000);
            resolve({banned:true, phone:clean, banTime:d.toISOString(), banTimeLocal:d.toLocaleString('fr-FR',{timeZone:'Africa/Lome'})+' GMT', violationType:data?.violation_type||data?.reason||'UNKNOWN', raw:data, isReal:true});
            try{sock.end()}catch{}
          }
        }
      }
      if(connection==='open' && !done){done=true; clearTimeout(to); resolve({banned:false, phone:clean, status:'active', message:'Numéro actif', isReal:true}); try{sock.end()}catch{}}
    });
    sock.requestRegistrationCode({phoneNumber:clean, method:'sms'}).catch(()=>{});
  });
}

app.get('/api/check/:phone', async (req,res)=>{
  console.log(`[APOTHEON] Check réel ${req.params.phone}`);
  try{ const r = await realCheck(req.params.phone); res.json(r); }catch(e){ res.status(500).json({error:e.message}); }
});
app.get('/api/health',(req,res)=>res.json({ok:true, seal:'𝐑Ø𝐈༽ †🌹ᴼᴿᴵᴳᴵᴺᴬᴸ𝐀𝐏𝐓'}));
app.listen(PORT, ()=>console.log(`APOTHEON REAL ONLINE :${PORT}`));
