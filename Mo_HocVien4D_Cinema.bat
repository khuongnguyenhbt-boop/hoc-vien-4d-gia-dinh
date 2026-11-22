@echo off
chcp 65001 >nul
title Hoc Vien 4D Cinema Gia Dinh
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel%==0 (
  echo Dang khoi dong Hoc Vien 4D Cinema Gia Dinh tai http://localhost:8765/cinema4d.html ...
  start "" http://localhost:8765/cinema4d.html
  node -e "const http=require('http'),fs=require('fs'),path=require('path');const root=process.cwd();const m={'.html':'text/html;charset=utf-8','.css':'text/css;charset=utf-8','.js':'application/javascript;charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'};http.createServer((req,res)=>{let p=decodeURIComponent(req.url.split('?')[0]);if(p==='/')p='/cinema4d.html';const f=path.join(root,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);return res.end('Not found');}res.writeHead(200,{'Content-Type':m[path.extname(f)]||'application/octet-stream','Referrer-Policy':'origin','Cache-Control':'no-store'});res.end(d);});}).listen(8765,'127.0.0.1',()=>console.log('Hoc Vien 4D Cinema dang chay tai http://localhost:8765/cinema4d.html (Dung tat cua so nay khi dang hoc!)'));"
) else (
  start "" "%~dp0cinema4d.html"
)
