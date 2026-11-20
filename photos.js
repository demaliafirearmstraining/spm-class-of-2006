(function () {
  var C = window.REUNION, $ = function (id) { return document.getElementById(id); };
  if (!C || !$("photo-form")) return;
  var BASE = C.supabaseUrl, KEY = C.supabaseKey;
  var MAX_FILES = 10, MAX_BYTES = 10 * 1024 * 1024, MAX_PX = 2000, THUMB_PX = 640;
  var pubUrl = function (name) { return BASE + "/storage/v1/object/public/reunion-photos/" + name; };
  var uuid = function () { return (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3 | 8)).toString(16); })); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- public gallery + lightbox ---------- */
  var photos = [], cur = 0;
  function loadGallery() {
    window.reunionRpc("reunion_public_photos", {}).then(function (rows) {
      photos = rows || [];
      var g = $("pgal"); $("pgal-empty").hidden = photos.length > 0;
      g.innerHTML = photos.map(function (p, i) {
        return '<button type="button" class="ph" data-i="' + i + '" aria-label="Open photo ' + (i + 1) + '"><img loading="lazy" alt="' + esc(p.caption || "Class photo shared by " + p.name) + '" src="' + pubUrl(p.id + "_t.jpg") + '"><span>' + esc(p.caption || p.name) + '</span></button>';
      }).join("");
    }).catch(function () { $("pgal-empty").hidden = false; });
  }
  $("pgal").addEventListener("click", function (e) { var b = e.target.closest("button[data-i]"); if (b) open(+b.getAttribute("data-i")); });
  function open(i) { cur = (i + photos.length) % photos.length; var p = photos[cur];
    $("lb-img").src = pubUrl(p.id + ".jpg");
    $("lb-cap").innerHTML = (p.caption ? "<b>" + esc(p.caption) + "</b><br>" : "") + "Shared by " + esc(p.name) + (p.year ? " &middot; " + esc(p.year) : "");
    $("lb").hidden = false; document.body.style.overflow = "hidden"; $("lb-close").focus(); }
  function close() { $("lb").hidden = true; $("lb-img").src = ""; document.body.style.overflow = ""; }
  $("lb-close").onclick = close; $("lb-prev").onclick = function () { open(cur - 1); }; $("lb-next").onclick = function () { open(cur + 1); };
  $("lb").addEventListener("click", function (e) { if (e.target === $("lb")) close(); });
  document.addEventListener("keydown", function (e) { if ($("lb").hidden) return; if (e.key === "Escape") close(); if (e.key === "ArrowLeft") open(cur - 1); if (e.key === "ArrowRight") open(cur + 1); });
  var tx = null; $("lb").addEventListener("touchstart", function (e) { tx = e.touches[0].clientX; }, { passive: true });
  $("lb").addEventListener("touchend", function (e) { if (tx == null) return; var dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 50) open(cur + (dx < 0 ? 1 : -1)); tx = null; });
  loadGallery();

  /* ---------- uploader ---------- */
  var form = $("photo-form"), input = $("photo-files"), picked = [];
  function renderPicked() {
    $("photo-list").innerHTML = picked.map(function (f, i) { return '<li><span>' + esc(f.name) + ' <small>(' + (f.size / 1048576).toFixed(1) + ' MB)</small></span><button type="button" class="x" data-r="' + i + '" aria-label="Remove">&times;</button></li>'; }).join("");
  }
  input.addEventListener("change", function () {
    var err = $("photo-err"); err.hidden = true; var msgs = [];
    Array.prototype.forEach.call(input.files, function (f) {
      if (picked.length >= MAX_FILES) { msgs.push("Up to " + MAX_FILES + " photos at a time."); return; }
      if (f.size > MAX_BYTES) { msgs.push(f.name + " is over 10 MB."); return; }
      if (!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(f.name)) { msgs.push(f.name + " isn't an image."); return; }
      picked.push(f);
    });
    input.value = ""; renderPicked();
    if (msgs.length) { err.textContent = msgs.filter(function (m, i, a) { return a.indexOf(m) === i; }).join(" "); err.hidden = false; }
  });
  $("photo-list").addEventListener("click", function (e) { var b = e.target.closest("button[data-r]"); if (b) { picked.splice(+b.getAttribute("data-r"), 1); renderPicked(); } });

  function decode(file) {
    if (window.createImageBitmap) return createImageBitmap(file, { imageOrientation: "from-image" }).catch(function () { return viaImg(file); });
    return viaImg(file);
  }
  function viaImg(file) { return new Promise(function (res, rej) { var u = URL.createObjectURL(file), im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("unreadable")); }; im.src = u; }); }
  function toJpeg(src, maxPx, q) {
    var w = src.width || src.naturalWidth, h = src.height || src.naturalHeight, r = Math.min(1, maxPx / Math.max(w, h));
    var c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w * r)); c.height = Math.max(1, Math.round(h * r));
    var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(src, 0, 0, c.width, c.height);
    return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error("encode")); }, "image/jpeg", q); });
  }
  function put(name, blob) {
    return fetch(BASE + "/storage/v1/object/reunion-photos-pending/" + name, { method: "POST",
      headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "image/jpeg", "x-upsert": "false", "cache-control": "max-age=31536000" }, body: blob
    }).then(function (r) { if (!r.ok) return r.text().then(function (t) { throw new Error("upload failed (" + r.status + ")"); }); });
  }
  function one(file, who) {
    return decode(file).then(function (img) { return Promise.all([toJpeg(img, MAX_PX, 0.82), toJpeg(img, THUMB_PX, 0.75)]); })
      .then(function (bl) { var id = uuid(); return put(id + ".jpg", bl[0]).then(function () { return put(id + "_t.jpg", bl[1]); })
        .then(function () { return window.reunionRpc("reunion_register_photo", { p_id: id, p_name: who.name, p_caption: who.cap, p_year: who.year, p_hp: who.hp }); }); });
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("photo-err"); err.hidden = true;
    var name = form.p_name.value.trim();
    if (!name) { err.textContent = "Please enter your name."; err.hidden = false; return; }
    if (!picked.length) { err.textContent = "Choose at least one photo."; err.hidden = false; return; }
    var who = { name: name, cap: form.p_caption.value, year: form.p_year.value, hp: form.p_website.value };
    var btn = $("photo-go"), prog = $("photo-prog"), total = picked.length, done = 0, fails = [];
    btn.disabled = true; prog.hidden = false;
    var queue = picked.slice();
    (function next() {
      if (!queue.length) {
        btn.disabled = false; prog.hidden = true;
        if (done) { $("photo-ok").hidden = false; $("photo-ok").textContent = "Thank you! " + done + " photo" + (done > 1 ? "s" : "") + " received. They'll appear in the gallery after an admin approves them."; picked = fails.map(function (f) { return f.file; }); renderPicked(); form.p_caption.value = ""; }
        if (fails.length) { err.textContent = "Couldn't send: " + fails.map(function (f) { return f.file.name + " (" + f.msg + ")"; }).join("; ") + ". Try JPG or PNG if it's a HEIC from a non-Apple device."; err.hidden = false; }
        return;
      }
      var f = queue.shift(); prog.textContent = "Uploading " + (done + fails.length + 1) + " of " + total + "\u2026";
      one(f, who).then(function () { done++; }).catch(function (ex) { fails.push({ file: f, msg: ex.message === "unreadable" ? "can't read this format" : ex.message }); }).then(next);
    })();
    $("photo-ok").hidden = true;
  });
})();
