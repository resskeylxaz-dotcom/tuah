const appendJoinListSafe = require('./joinlist');
const { isGroupCodeExistJoin } = require('./joinlist');

async function processAutoJoin(sock, links, sendProgressFn, sharedBy = '') {
    let results = [], success = [], expired = [], failed = [];

    for (let idx = 0; idx < links.length; idx++) {
        const link = links[idx];
        const code = link.split('/').pop();

        if (isGroupCodeExistJoin(link)) {
            results.push({ link, status: 'duplikat', name: '' });
            continue;
        }

        try {
            const info = await sock.groupGetInviteInfo(code);
            if (!info.id) throw new Error('Invalid group');
            if (info.isExpired) {
                expired.push(link);
                results.push({ link, status: 'kadaluarsa', name: info.subject });
                continue;
            }

            await sock.groupAcceptInvite(code);
            success.push({ link, info });
            results.push({ link, status: 'berhasil', name: info.subject });

            // Jeda 2 detik setelah setiap join sukses
            await new Promise(res => setTimeout(res, 2000));

            // Jeda tambahan 1 menit setiap 30 join sukses
            if ((success.length % 30 === 0) && success.length > 0) {
                await new Promise(res => setTimeout(res, 60000));
            }
        } catch (e) {
            failed.push(link);
            results.push({ link, status: 'gagal', error: e.message });
        }
    }

    if (success.length > 0) appendJoinListSafe(success.map(s => ({
        link: s.link,
        info: s.info,
        sharedBy
    })));

    const summary = [
        `*AutoJoin Selesai*`,
        `Berhasil: ${success.length}`,
        `Gagal: ${failed.length}`,
        `Link Kadaluarsa: ${expired.length}`,
        ``,
        ...results.slice(0, 10).map((r,i) =>
            `${i+1}. ${r.link}\n   Status: ${r.status}${r.name ? `\n   Nama: ${r.name}` : ''}${r.error ? `\n   Error: ${r.error}` : ''}`
        ),
        results.length > 10 ? `\nDan ${results.length-10} lagi...` : ''
    ].join('\n');

    return summary;
}

module.exports = processAutoJoin;