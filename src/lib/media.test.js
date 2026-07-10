// Contract test for src/lib/media.js — runnable under Node:
//   node src/lib/media.test.js
import assert from 'node:assert/strict';

const {
  normalizeMediaUrl, youTubeId, youTubeThumb, youTubeEmbed, isVideoUrl,
} = await import('./media.js');

// ---- normalizeMediaUrl ----
assert.equal(normalizeMediaUrl('https://res.cloudinary.com/demo/image/upload/x.png'), 'https://res.cloudinary.com/demo/image/upload/x.png');
assert.equal(normalizeMediaUrl('  https://a.b/c.jpg  '), 'https://a.b/c.jpg');
assert.equal(normalizeMediaUrl('http://insecure.example/x.png'), '', 'http rejected');
assert.equal(normalizeMediaUrl('javascript:alert(1)'), '');
assert.equal(normalizeMediaUrl(''), '');
assert.equal(normalizeMediaUrl(null), '');
assert.equal(normalizeMediaUrl('data:image/png;base64,AAAA'), '', 'data URI rejected by default');
assert.equal(normalizeMediaUrl('data:image/png;base64,AAAA', { allowDataUri: true }), 'data:image/png;base64,AAAA');
assert.equal(normalizeMediaUrl('data:text/html,<b>x</b>', { allowDataUri: true }), '', 'only image data URIs');

// ---- youTubeId across the URL shapes ----
const ID = 'dQw4w9WgXcQ';
for (const u of [
  `https://www.youtube.com/watch?v=${ID}`,
  `https://www.youtube.com/watch?list=PL1&v=${ID}`,
  `https://youtu.be/${ID}`,
  `https://youtube.com/shorts/${ID}`,
  `https://www.youtube.com/embed/${ID}`,
  `https://www.youtube-nocookie.com/embed/${ID}`,
  `https://www.youtube.com/live/${ID}`,
]) assert.equal(youTubeId(u), ID, u);
assert.equal(youTubeId('https://vimeo.com/12345'), null);
assert.equal(youTubeId('https://www.youtube.com/watch?v=short'), null, '11-char ids only');
assert.equal(youTubeId(''), null);

assert.equal(youTubeThumb(ID), `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
assert.ok(youTubeEmbed(ID).startsWith('https://www.youtube-nocookie.com/embed/'));

// ---- isVideoUrl ----
assert.equal(isVideoUrl(`https://youtu.be/${ID}`), true);
assert.equal(isVideoUrl('https://cdn.example.com/clip.mp4'), true);
assert.equal(isVideoUrl('https://res.cloudinary.com/demo/video/upload/v1/clip.mov'), true);
assert.equal(isVideoUrl('https://a.b/photo.png'), false);
assert.equal(isVideoUrl(''), false);

console.log('media.test.js: all assertions passed');
