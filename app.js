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
