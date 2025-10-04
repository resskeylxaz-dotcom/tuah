const fs = require('fs');

const processAutoJoin = require('./autojoin');

const {

  getScanStatus,

  getFoundListStats,

  getFoundListPreview,

  getFoundListBySharerPrefix,

} = require('./statusHelpers');

const { isGroupCodeExist } = require('./foundlist');

const { isGroupCodeExistJoin } = require('./joinlist');

const appendJoinListSafe = require('./joinlist');

// === GANTI KE NOMOR OWNER ANDA ===

const OWNER_JID = '6285752433671@s.whatsapp.net'; // contoh: 6281234567890@s.whatsapp.net

let joinliveActive = false;

// ================================

// Motif Kotak Tebal & Kategori

// ================================

function boxMotif(title, lines) {

  // Title max 18 char untuk rata tengah

  const paddedTitle = title.length < 18

    ? title + ' '.repeat(18 - title.length)

    : title;

  return [

    "╔═✦✦✦✦✦✦✦✦✦✦✦✦✦✦═╗",

    `║ ${paddedTitle} ║`,

    "╠═───────────────═╣",

    ...lines.map(line =>

      line

        ? `║ ${line}` 

        : "║"

    ),

    "╚═✦✦✦✦✦✦✦✦✦✦✦✦✦✦═╝"

  ].join('\n');

}

// ================================

// Template Menu

// ================================

const menuLines = [

  "🛡️  Scan & Join",

  "  • *.scanlive on/off*    Aktif/nonaktif scan grup",

  "  • *.joinlive on/off*    Aktif/nonaktif auto join",

  "  • *.autojoin <link>*    Join batch grup",

  "",

  "📂  Database",

  "  • *.foundlist*         Semua hasil scan",

  "  • *.joinlist*          Grup di-join",

  "",

  "📊  Info & Setting",

  "  • *.status*            Status bot",

  "  • *.menu*              Menu ini",

  "",

  "💡 Tips Bot:",

  "  • Kirim link grup di chat/grup, bot auto proses jika scanlive aktif",

  "  • Command hanya untuk owner"

];

const menuText = boxMotif("🤖  BOT MENU", menuLines);

// ================================

// Helper Generator untuk List Grup

// ================================

function generateGroupListBox(title, list) {

  if (!list || list.length === 0) {

    return boxMotif(title, ["Belum ada grup yang ditemukan."]);

  }

  const lines = [];

  list.forEach((g, i) => {

    lines.push(`${i + 1}. 🏷️ ${g.name || '(Tanpa Nama)'}`);

    lines.push(`   🖇️ Link: ${g.link}`);

    lines.push(`   👥 Member: ${g.memberCount || 0}`);

    lines.push(`   👑 Owner: ${g.creator || '-'}`);

    lines.push("");

  });

  return boxMotif(title, lines);

}

// ================================

// Handler Command

// ================================

async function handleCommand(command, sock, msg, args, getScanState, setScanState) {

  const senderJid = msg.key.participant || msg.key.remoteJid;

  if (senderJid !== OWNER_JID) return;

  const senderGroupId = msg.key.remoteJid;

  switch (command) {

    case '.menu':

      await sock.sendMessage(senderGroupId, { text: menuText }, { quoted: msg });

      break;

    case '.status': {

      const scanStatus = await getScanStatus(getScanState());

      const foundStats = await getFoundListStats();

      const lines = [

        "🛡️ ScanLive: " + (scanStatus.includes("Aktif") ? "Aktif" : "Nonaktif"),

        "🚀 JoinLive: " + (joinliveActive ? "Aktif" : "Nonaktif"),

        ...foundStats.split('\n').map(x => x.trim()).filter(x => x),

      ];

      await sock.sendMessage(senderGroupId, { text: boxMotif("📊  STATUS BOT", lines) }, { quoted: msg });

      break;

    }

    case '.scanlive':

      if (args[0] && args[0].toLowerCase() === "on") {

        setScanState("Running");

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("🛡️ SCANLIVE AKTIF", [

            "Semua link grup valid yang baru akan",

            "langsung disimpan ke daftar foundlist."

          ])

        }, { quoted: msg });

      } else if (args[0] && args[0].toLowerCase() === "off") {

        setScanState("Idle");

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("🛡️ SCANLIVE NONAKTIF", [

            "Scan live grup telah dimatikan."

          ])

        }, { quoted: msg });

      } else {

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("❓ PENGGUNAAN", [

            "Penggunaan: .scanlive on / .scanlive off"

          ])

        }, { quoted: msg });

      }

      break;

    case '.foundlist': {

      const preview = await getFoundListPreview();

      const list = preview.split('\n\n')

        .filter(Boolean)

        .map(block => {

          const lines = block.split('\n');

          return {

            name: lines[0]?.replace(/^\d+\.\s*/, '').trim(),

            link: lines[1]?.replace(/.*Link:\s*/, '').trim(),

            memberCount: lines[2]?.replace(/.*Member:\s*/, '').trim(),

            creator: lines[3]?.replace(/.*Owner:\s*/, '').trim(),

          };

        });

      await sock.sendMessage(senderGroupId, { text: generateGroupListBox("📂 DAFTAR GRUP SCAN", list) }, { quoted: msg });

      break;

    }

    case '.joinlive':

      if (args[0] && args[0].toLowerCase() === "on") {

        joinliveActive = true;

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("🛡️ JOINLIVE AKTIF", [

            "Semua link grup valid yang baru akan",

            "langsung di-join dan disimpan ke daftar joinlist."

          ])

        }, { quoted: msg });

      } else if (args[0] && args[0].toLowerCase() === "off") {

        joinliveActive = false;

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("🛡️ JOINLIVE NONAKTIF", [

            "Auto join grup telah dimatikan."

          ])

        }, { quoted: msg });

      } else {

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("❓ PENGGUNAAN", [

            "Penggunaan: .joinlive on / .joinlive off"

          ])

        }, { quoted: msg });

      }

      break;

    case '.autojoin':

      if (args.length === 0)

        return await sock.sendMessage(senderGroupId, {

          text: boxMotif("❓ PENGGUNAAN", [

            "Penggunaan: .autojoin link1 link2 ..."

          ])

        }, { quoted: msg });

      await sock.sendMessage(senderGroupId, {

        text: boxMotif("🚀 AUTOJOIN PROSES", [

          `Memproses autojoin ${args.length} link...`

        ])

      }, { quoted: msg });

      let summary = '';

      for (let i = 0; i < args.length; i++) {

        const link = args[i];

        if (isGroupCodeExistJoin(link)) {

          summary += `Link ke-${i + 1} sudah pernah diproses, di-skip.\n`;

          continue;

        }

        summary += await processAutoJoin(sock, [link], null);

        await new Promise(res => setTimeout(res, 2000));

      }

      await sock.sendMessage(senderGroupId, {

        text: boxMotif("🚀 AUTOJOIN RANGKUMAN", [summary.trim() || 'Tidak ada link yang diproses.'])

      }, { quoted: msg });

      break;

    case '.clearlink':

      try {

        fs.writeFileSync('foundlist.json', '[]');

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("🗂️ CLEAR LINK", [

            "foundlist.json sudah dikosongkan."

          ])

        }, { quoted: msg });

      } catch (e) {

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("❌ ERROR", [

            "Gagal clear foundlist: " + e.message

          ])

        }, { quoted: msg });

      }

      break;

    case '.listgb':

      try {

        const data = fs.existsSync('joined_groups.json') ? JSON.parse(fs.readFileSync('joined_groups.json')) : [];

        await sock.sendMessage(senderGroupId, { text: generateGroupListBox("📜 LIST GRUP DI-JOIN", data.slice(0, 10)) }, { quoted: msg });

      } catch (e) {

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("❌ ERROR", [

            "Gagal membaca joined_groups.json: " + e.message

          ])

        }, { quoted: msg });

      }

      break;

    case '.joinlist':

      try {

        const data = fs.existsSync('joinlist.json') ? JSON.parse(fs.readFileSync('joinlist.json')) : [];

        await sock.sendMessage(senderGroupId, { text: generateGroupListBox("📑 JOINLIST GRUP", data.slice(0, 10)) }, { quoted: msg });

      } catch (e) {

        await sock.sendMessage(senderGroupId, {

          text: boxMotif("❌ ERROR", [

            "Gagal membaca joinlist.json: " + e.message

          ])

        }, { quoted: msg });

      }

      break;

    // Tidak ada default: balasan error motif dihapus!

  }

}

module.exports = handleCommand;

module.exports.joinliveActive = () => joinliveActive;