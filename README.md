# `🤖AkR-Bot🤖`
Bot enfocado solamente para la administración de grupos de Whatsapp para jugadores de Tibia.

### `—◉ 🧿 COMANDOS 🧿`
![img](https://i.imgur.com/xZ6gpe6.png)

### `—◉ 👾 ACTIVAR EN UBUNTU 22.04 👾`
ESCRIBE LOS SIGUIENTES COMANDOS UNO POR UNO:
- Actualizando el servidor e installando NodeJS
```bash
sudo apt-get update && sudo apt-get upgrade
sudo apt install npm
```
- Clonando el repositorio
```bash
git clone https://github.com/AckorEXE/AkR-Bot3.git
```
- Dirigiendo a la carpeta e instalando las dependencias y librerías
```bash
cd AkR-Bot3
npm install
npm start
```
- Una vez iniciado y generado nuestro código QR hacemos una conexión para tenerla lista

### `—◉ ✔️ CREAR SERVICIO DE EJECUCIÓN AUTOMATICA UTLIZANDO PM2✔️`
Nos dirigimos a la carpeta de nuestro Bot e instalamos PM2 y creamos el servicio
```bash
cd AkR-Bot3
sudo npm install -g pm2
pm2 start npm --name "index.js" -- start
pm2 save
pm2 save --force
sudo npm install -g pm2 && pm2 update
```

### `—◉ ✔️ CREAR AUTO START EN WINDOWS✔️`
Nos dirigimos a la carpeta de nuestro Bot, creamos un bloc de notas llamado auto.start.bat y dentro de el agregamos:
```bash
@echo off
:loop
tasklist /fi "imagename eq node.exe" | find /i "node.exe" > nul
if errorlevel 1 (
    cd C:\Users\Administrator\Downloads\AkR-Bot3-main
    start cmd /k "npm start"
)
timeout /t 10 /nobreak > nul
goto loop

```
- Reemplazar cd C:\Users\ackorvps\Downloads\AkR-Bot3-main por la ruta correcta de la carpeta


### `—◉ 🤔 FAQ 🤔`
- Si no conoces la ruta puedes navegar hasta la carpeta del bot utilizando los comandos  
`ls  // Sirve para ver todas las carpetas y contenido de la ruta actual`  
`cd  // Sirve para posicionarte dentro de una carpeta`  
- Una vez dentro de la ruta utilizamos el siguiente comando para obtener la ruta en especifico  
`pwd`
- Si quieres ver el estado de el servicio utiliza
`sudo systemctl status AkR-Bot.service`

### `—◉ ✅ FAQ ✅`
Para mantenerse actualizado hacer pull al repositorio utilizando
```bash
cd AkR-Bot
git pull
sudo systemctl restart AkR-Bot.service
```

Actualización de NodeJS
```bash
sudo npm install -g n
sudo n lts
hash -r
rehash
```

Actualización de Puppeteer
```bash
sudo apt-get install libgbm1
sudo apt-get install libgbm2
npm install puppeteer@latest
```

Actualización de Whatsapp-Web.js
```bash
npm install whatsapp-web.js@next
```

Actualización de Whatsapp-Web.js con integración Webpack-exodus
```bash
npm install github:pedroslopez/whatsapp-web.js#webpack-exodus
```

### `—◉ 👑 DUDAS SOBRE EL BOT?, CONTACTAME 👑`
<a href="http://wa.me/528251002140" target="blank"><img src="https://img.shields.io/badge/ACKOR-25D366?style=for-the-badge&logo=whatsapp&logoColor=white" /></a>

