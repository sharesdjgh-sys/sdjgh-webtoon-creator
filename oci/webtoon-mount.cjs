'use strict';

const { createWebtoonStore } = require('./webtoon-store.cjs');
const { createWebtoonRouter } = require('./webtoon-router.cjs');
const { verifySession } = require('../services/account-session.cjs');
const { createAppPolicy } = require('../services/app-policy.cjs');

// 서버의 비공개 영구 경로를 운영자가 설정하기 전에는 모든 요청을 닫아 둔다.
if (!process.env.WEBTOON_DATA_DIR) {
  module.exports = (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'storage_unconfigured' });
  };
} else {
  const store = createWebtoonStore(process.env.WEBTOON_DATA_DIR);
  module.exports = createWebtoonRouter({ store, verifySession,
    allows: (appId, role) => createAppPolicy().allows(appId, role) });
}
