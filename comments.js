/* Cherry Sage — per-post comments. Drops into any page with a <div id="csComments" data-post-title="...">.
   Posting requires being signed in (Bev asked for this twice: "users must be registered and
   logged in to... comment on posts and articles"). Reading approved comments stays open to
   everyone, only the write path is gated. Enforced server-side too, in comments.mjs, not just here. */
(function () {
  var box = document.getElementById("csComments");
  if (!box) return;
  var slug = location.pathname.replace(/^\//, "").replace(/\.html$/, "") || "home";
  var title = box.getAttribute("data-post-title") || document.title;
  var t0 = Date.now();

  box.innerHTML =
    '<h3 class="cs-comments-h">Comments</h3>' +
    '<div class="cs-comments-list" id="csCommentsList"><p class="cs-comments-empty">Loading comments…</p></div>' +
    '<div id="csCommentsAction"><p class="cs-comments-empty">Checking your account…</p></div>';

  var list = document.getElementById("csCommentsList");
  fetch("/.netlify/functions/comments?post=" + encodeURIComponent(slug))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var comments = (d && d.comments) || [];
      if (!comments.length) { list.innerHTML = '<p class="cs-comments-empty">Be the first to leave a comment.</p>'; return; }
      list.innerHTML = comments.map(function (c) {
        var when = new Date(c.ts).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
        return '<div class="cs-comment"><div class="cs-comment-head"><span class="cs-comment-name">' + esc(c.name) +
          '</span><span class="cs-comment-date">' + when + "</span></div><p>" + esc(c.message).replace(/\n/g, "<br>") + "</p></div>";
      }).join("");
    })
    .catch(function () { list.innerHTML = '<p class="cs-comments-empty">Comments could not load right now.</p>'; });

  var action = document.getElementById("csCommentsAction");
  if (!window.supabase) { renderLoggedOut(); return; }
  var sb = window.supabase.createClient(
    "https://ctoeuikxoqlhnebgsygp.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0b2V1aWt4b3FsaG5lYmdzeWdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODM4NTMsImV4cCI6MjA5NjA1OTg1M30.Cy0uf8hm-Biea7a1V3bLQBz70f1oyhP83vHDjefTce8",
    { db: { schema: "cherry_sage" } }
  );
  sb.auth.getSession().then(function (res) {
    var session = res.data && res.data.session;
    if (!session) { renderLoggedOut(); return; }
    renderForm(session);
  }).catch(function () { renderLoggedOut(); });

  function renderLoggedOut() {
    action.innerHTML = '<p class="cs-comments-sub">Please <a href="/login.html">log in</a> to leave a comment.</p>';
  }

  function renderForm(session) {
    action.innerHTML =
      '<form class="cs-comments-form" id="csCommentsForm" novalidate>' +
        '<p class="cs-comments-sub">Leave a comment as ' + esc(session.user.email) + '. Cherry reads and approves every one herself before it shows here.</p>' +
        '<input type="text" name="name" placeholder="Your name (optional)" maxlength="120">' +
        '<textarea name="message" rows="4" placeholder="Your comment..." required maxlength="2000"></textarea>' +
        '<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
        '<button class="btn btn-primary" type="submit">Post comment</button>' +
        '<p class="cs-comments-note" id="csCommentsNote" hidden></p>' +
      "</form>";

    document.getElementById("csCommentsForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, note = document.getElementById("csCommentsNote");
      var message = (f.message.value || "").trim();
      if (!message) { note.hidden = false; note.textContent = "Please write a comment first."; return; }
      var btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Sending...";
      fetch("/.netlify/functions/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + session.access_token },
        body: JSON.stringify({ postSlug: slug, postTitle: title, name: f.name.value.trim(), message: message, website: f.website.value, t: t0 }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d && d.error) {
            btn.disabled = false; btn.textContent = "Post comment";
            note.hidden = false; note.textContent = d.error === "unauthorized" ? "Please log in again to comment." : "Something went wrong, please try again.";
            return;
          }
          action.innerHTML = '<p class="cs-comments-thanks">Thank you. Cherry reads every comment herself, and once she approves it, it will appear here.</p>';
        })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Post comment";
          note.hidden = false; note.textContent = "Something went wrong, please try again.";
        });
    });
  }

  function esc(s) { return String(s || "").replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
})();
