(function () {
  var C = window.REUNION;
  function rpc(fn, body) {
    return fetch(C.supabaseUrl + "/rest/v1/rpc/" + fn, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: C.supabaseKey, Authorization: "Bearer " + C.supabaseKey },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var data = null; try { data = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((data && data.message) || "Request failed"); err.status = r.status; err.code = data && data.code; throw err; }
        return data;
      });
    });
  }
  window.reunionRpc = rpc;
  var $ = function (id) { return document.getElementById(id); };
  var set = function (id, v) { var e = $(id); if (e) e.textContent = v; };

  if ($("rsvp")) document.title = C.title + " \u2013 " + C.school;
  set("school", C.school); set("loc", C.location); set("title", C.title); set("tagline", C.tagline);
  set("year", "\u2605 " + C.classYear + " \u2605");
  function fact(id, val, ph) { var el = $(id); if (!el) return; var s = el.querySelector("span"); if (val) { s.textContent = val; el.classList.remove("tbd"); } else { s.textContent = ph; el.classList.add("tbd"); } }
  fact("f-date", C.date + (C.date && C.time ? " \u00b7 " + C.time : ""), "Date coming soon");
  fact("f-venue", C.venue, "Venue coming soon");
  if (C.contact && $("contact")) set("contact", C.contact);


  // ---- Add to calendar (needs C.dateISO) ----
  if (C.dateISO && $("cal")) {
    var d0 = C.dateISO.replace(/-/g, "");
    var allDay = !C.startTime;
    function addDay(iso) { var d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10).replace(/-/g, ""); }
    var tt = function (t) { return t.replace(":", "") + "00"; };
    var startV, endV;
    if (allDay) { startV = d0; endV = addDay(C.dateISO); }
    else { startV = d0 + "T" + tt(C.startTime); endV = d0 + "T" + tt(C.endTime || C.startTime); }
    var title = C.school + " " + C.title;
    var notes = "Class of " + C.classYear + " reunion." + (C.time ? " Time: " + C.time + "." : " Time TBA.") + (C.venue ? "" : " Venue TBA.") + " RSVP and updates: " + location.origin + location.pathname.replace(/[^\/]*$/, "");
    var where = C.venue || "";
    var g = "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" + encodeURIComponent(title) +
      "&dates=" + startV + "/" + endV + "&details=" + encodeURIComponent(notes) + (where ? "&location=" + encodeURIComponent(where) : "") +
      (allDay ? "" : "&ctz=America/New_York");
    $("cal-google").href = g;
    var esc = function (t) { return String(t).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); };
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SPM Class of 2006//Reunion//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT",
      "UID:spm-class-of-2006-" + d0 + "@spm-class-of-2006", "DTSTAMP:" + new Date().toISOString().replace(/[-:]|\.\d{3}/g, ""),
      allDay ? "DTSTART;VALUE=DATE:" + startV : "DTSTART;TZID=America/New_York:" + startV,
      allDay ? "DTEND;VALUE=DATE:" + endV : "DTEND;TZID=America/New_York:" + endV,
      "SUMMARY:" + esc(title), "DESCRIPTION:" + esc(notes)].concat(where ? ["LOCATION:" + esc(where)] : []).concat(["END:VEVENT", "END:VCALENDAR"]).join("\r\n");
    var icsA = $("cal-ics");
    icsA.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
    icsA.download = "spm-class-of-2006-reunion.ics";
    $("cal").hidden = false;
  }

  var form = $("rsvp");
  if (!form) return;
  var guestsWrap = $("guests-wrap");
  function syncGuests() { var a = form.attending.value; guestsWrap.style.display = a === "no" ? "none" : ""; }
  form.addEventListener("change", syncGuests); syncGuests();

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var err = $("err"); err.hidden = true;
    if (!form.attending.value) { err.textContent = "Please choose Yes, Maybe or No."; err.hidden = false; return; }
    var btn = $("go"); btn.disabled = true; btn.textContent = "Sending\u2026";
    rpc("reunion_submit_rsvp", {
      p_full_name: form.full_name.value, p_maiden_name: form.maiden_name.value, p_email: form.email.value,
      p_phone: form.phone.value, p_attending: form.attending.value,
      p_guests: parseInt(form.guests.value || "0", 10) || 0, p_address: form.address.value,
      p_note: form.note.value, p_hp: form.website.value
    }).then(function () {
      form.hidden = true; $("form-head").hidden = true; $("thanks").hidden = false;
      var a = form.attending.value;
      set("thanks-msg", a === "yes" ? "We can\u2019t wait to see you. We\u2019ll email you as soon as the date and venue are set."
        : a === "maybe" ? "Thanks \u2014 we\u2019ll keep you posted and hope you can make it."
        : "Sorry you can\u2019t make it \u2014 we\u2019ll still send updates and photos.");
      window.scrollTo({ top: $("thanks").offsetTop - 20, behavior: "smooth" });
    }).catch(function (ex) {
      btn.disabled = false; btn.textContent = "Send my response";
      err.textContent = "Sorry, something went wrong (" + ex.message + "). Please check your details and try again."; err.hidden = false;
    });
  });
})();
