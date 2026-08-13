/**
 * MusicFree 插件 —— 简单音乐 (jdynb.xyz)
 *
 * 数据源：http://m.jdynb.xyz
 * 适配方式：JSON API 对接（站点为 Vite SPA，内部 API 已通过直接观察获取）
 *
 * 已实现能力：
 *   - search        搜索（单曲 / 专辑 / 歌手 / 歌单）
 *   - getMediaSource 获取播放链接（128k MP3 / 2000k FLAC）
 *   - getLyric      获取歌词
 *   - getAlbumInfo  专辑详情
 *   - getMusicSheetInfo 歌单详情
 *   - getArtistWorks 歌手作品（单曲 / 专辑）
 *
 * 说明：站点排行榜接口（/music/rank/getMusicList）当前在后端返回异常，
 *       故未实现 getTopLists，避免暴露不可用入口。
 */

const axios = require('axios');

const BASE_URL = 'http://m.jdynb.xyz/api';
const PAGE_SIZE = 20;

// 站点统一在请求头携带 API-Key: test
const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'API-Key': 'test',
    },
    timeout: 10000,
});

// 音质 -> 站点 bridge 值
// 站点仅提供两种音质：128kmp3（流畅）、2000kflac（无损）
function qualityToBridge(quality) {
    if (quality === 'high' || quality === 'super') {
        return '2000kflac';
    }
    return '128kmp3';
}

// 将站点歌曲对象转换为 IMusicItem
function mapSong(item) {
    return {
        id: String(item.id),
        title: item.name || '',
        artist: item.artist || '',
        album: item.album || '',
        artwork: item.pic120 || item.pic || '',
        duration: item.duration || 0,
    };
}

// 将站点专辑对象转换为 IAlbumItem
function mapAlbum(item) {
    return {
        id: String(item.albumId != null ? item.albumId : item.id),
        title: item.album || item.name || '',
        artwork: item.pic || '',
        artist: item.artist || '',
    };
}

// 将站点歌手对象转换为 IArtistItem
function mapArtist(item) {
    return {
        id: String(item.id),
        name: item.name || '',
        avatar: item.pic300 || item.pic || item.pic120 || '',
        fans: item.artistFans || 0,
        description: item.musicNum ? `单曲 ${item.musicNum} 首` : '',
    };
}

// 将站点歌单对象转换为 IMusicSheetItem
function mapSheet(item) {
    return {
        id: String(item.id),
        title: item.name || '',
        artwork: item.img || '',
        artist: item.uname || '',
        playCount: item.listencnt || 0,
        worksNum: item.total || 0,
    };
}

module.exports = {
    // ===== 必填属性 =====
    platform: '简单音乐(jdynb)',

    // ===== 可选属性 =====
    version: '0.0.1',
    author: 'jdynb-plugin',
    description: 'MusicFree 插件：对接 http://m.jdynb.xyz 音乐源（搜索/播放/歌词/专辑/歌单/歌手）',
    cacheControl: 'no-cache',
    supportedSearchType: ['music', 'album', 'artist', 'sheet'],

    // ===== 搜索 =====
    async search(query, page, type) {
        if (type === 'music') {
            const res = await api.get('/music/search', {
                params: { keyword: query, pageNo: page, pageSize: PAGE_SIZE },
            });
            const d = res.data?.data;
            const list = (d?.data) || [];
            const total = d?.total || 0;
            return {
                isEnd: page * PAGE_SIZE >= total,
                data: list.map(mapSong),
            };
        }
        if (type === 'album') {
            const res = await api.get('/music/search/album', {
                params: { keyword: query, pageNo: page, pageSize: PAGE_SIZE },
            });
            const d = res.data?.data;
            const list = (d?.data) || [];
            const total = d?.total || 0;
            return {
                isEnd: page * PAGE_SIZE >= total,
                data: list.map(mapAlbum),
            };
        }
        if (type === 'artist') {
            const res = await api.get('/music/search/artist', {
                params: { keyword: query, pageNo: page, pageSize: PAGE_SIZE },
            });
            const d = res.data?.data;
            const list = (d?.data) || [];
            const total = d?.total || 0;
            return {
                isEnd: page * PAGE_SIZE >= total,
                data: list.map(mapArtist),
            };
        }
        if (type === 'sheet') {
            const res = await api.get('/music/search/playlist', {
                params: { keyword: query, pageNo: page, pageSize: PAGE_SIZE },
            });
            const d = res.data?.data;
            const list = (d?.data) || [];
            const total = d?.total || 0;
            return {
                isEnd: page * PAGE_SIZE >= total,
                data: list.map(mapSheet),
            };
        }
        return { isEnd: true, data: [] };
    },

    // ===== 获取播放链接 =====
    async getMediaSource(musicItem, quality) {
        const res = await api.get('/music/play/info', {
            params: { id: musicItem.id, bridge: qualityToBridge(quality) },
        });
        const url = res.data?.data?.url;
        if (!url) {
            throw new Error('无法获取播放链接');
        }
        return {
            url,
            headers: {
                Referer: 'http://m.jdynb.xyz/',
            },
        };
    },

    // ===== 获取歌词 =====
    async getLyric(musicItem) {
        const res = await api.get('/music/lyric/' + musicItem.id);
        const rawLrc = res.data?.data || '';
        return {
            rawLrc,
        };
    },

    // ===== 专辑详情 =====
    async getAlbumInfo(albumItem, page) {
        const res = await api.get('/music/album/info', {
            params: { id: albumItem.id },
        });
        const d = res.data?.data || {};
        const list = (d.musicList) || [];
        const result = {
            isEnd: true,
            musicList: list.map(mapSong),
        };
        if (page === 1) {
            result.albumItem = {
                title: d.name || albumItem.title,
                artist: d.artist || albumItem.artist,
                artwork: d.img || albumItem.artwork,
                description: (d.info || '').slice(0, 500),
                createAt: d.releaseDate ? new Date(d.releaseDate).getTime() : undefined,
            };
        }
        return result;
    },

    // ===== 歌单详情 =====
    async getMusicSheetInfo(sheetItem, page) {
        const res = await api.get('/music/playlist/info', {
            params: { pid: sheetItem.id, pageNo: page, pageSize: 50 },
        });
        const d = res.data?.data || {};
        const list = (d.musicList) || [];
        const total = d.total || list.length;
        return {
            isEnd: page * 50 >= total,
            musicList: list.map(mapSong),
            sheetItem: page === 1 ? {
                title: d.name || sheetItem.title,
                artist: d.uname || sheetItem.artist,
                artwork: d.img || sheetItem.artwork,
                description: (d.desc || d.info || '').slice(0, 500),
                worksNum: d.total,
                playCount: d.listencnt,
            } : undefined,
        };
    },

    // ===== 歌手作品 =====
    async getArtistWorks(artistItem, page, type) {
        if (type === 'album') {
            const res = await api.get('/music/artist/album', {
                params: { artistId: artistItem.id, pageNo: page, pageSize: 50 },
            });
            const d = res.data?.data;
            const list = (d?.data) || [];
            const total = d?.total || 0;
            return {
                isEnd: page * 50 >= total,
                data: list.map(mapAlbum),
            };
        }
        // 默认 / music
        const res = await api.get('/music/artist/music', {
            params: { artistId: artistItem.id, pageNo: page, pageSize: 50 },
        });
        const d = res.data?.data;
        const list = (d?.data) || [];
        const total = d?.total || 0;
        return {
            isEnd: page * 50 >= total,
            data: list.map(mapSong),
        };
    },
};
