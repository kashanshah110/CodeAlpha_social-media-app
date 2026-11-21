const appContent = document.querySelector("#app-content");
const accountNav = document.querySelector("#account-nav");
const globalMessage = document.querySelector("#global-message");
const apiStatus = document.querySelector("#api-status");
let messageTimer;

const state = {
    user: null,
    posts: [],
    comments: {},
    commentsLoading: new Set(),
    openComments: new Set(),
    editingPostId: null,
    editingCommentId: null,
    profileData: null,
    editingProfile: false,
    connectionMode: null,
    connectionUsers: [],
    connectionLoading: false,
    exploreQuery: "",
    exploreResults: [],
    renderVersion: 0,
};

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    })[character]);
}

function safeImageUrl(value) {
    if (!value) return "";
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password
            ? url.href
            : "";
    } catch {
        return "";
    }
}

function avatar(user, large = false) {
    const name = user && user.username ? user.username : "?";
    const imageUrl = safeImageUrl(user && user.profileImageUrl);
    const sizeClass = large ? " large" : "";
    if (imageUrl) {
        return `<img class="avatar${sizeClass}" src="${escapeHtml(imageUrl)}" alt="">`;
    }
    return `<span class="avatar${sizeClass}" aria-hidden="true">${escapeHtml(name.charAt(0).toUpperCase())}</span>`;
}

function showMessage(message, type = "success") {
    window.clearTimeout(messageTimer);
    globalMessage.textContent = message;
    globalMessage.dataset.visible = "true";
    globalMessage.dataset.type = type;
    globalMessage.setAttribute("role", type === "error" ? "alert" : "status");
    messageTimer = window.setTimeout(clearMessage, 6000);
}

function clearMessage() {
    window.clearTimeout(messageTimer);
    globalMessage.textContent = "";
    globalMessage.dataset.visible = "false";
    globalMessage.dataset.type = "";
}

async function request(url, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (options.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    const response = await fetch(url, {
        credentials: "same-origin",
        ...options,
        headers,
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || "The request could not be completed.");
    }
    return data;
}

function profileHref(username) {
    return `#/profile/${encodeURIComponent(username)}`;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
    });
}

function renderNavigation() {
    accountNav.innerHTML = state.user
        ? `<a class="nav-profile" aria-label="View @${escapeHtml(state.user.username)} profile" href="${profileHref(state.user.username)}">${avatar(state.user)}<span>@${escapeHtml(state.user.username)}</span></a>
           <button class="secondary" type="button" data-action="logout">Log out</button>`
        : `<a class="button secondary" href="#/login">Log in</a>
           <a class="button" href="#/register">Join</a>`;
}

function renderLoading(message = "Loading...") {
    appContent.innerHTML = `<section class="loading-card" role="status">${escapeHtml(message)}</section>`;
}

function renderLoadError(message) {
    appContent.innerHTML = `<section class="empty-card" role="alert">
        <h1>We could not load this page</h1>
        <p>${escapeHtml(message)}</p>
        <button type="button" class="secondary" data-action="retry">Try again</button>
    </section>`;
}

function renderEmpty(title, description) {
    return `<section class="empty-card">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
    </section>`;
}

function renderComposer() {
    if (!state.user) {
        return `<section class="card composer-prompt">
            <h2>Have something to share?</h2>
            <p class="muted">Log in or join Socially to write your first post.</p>
            <a class="button" href="#/register">Create an account</a>
        </section>`;
    }
    return `<form class="card composer" data-form="post-create">
        <label class="sr-only" for="new-post-content">Write a post</label>
        <textarea id="new-post-content" name="content" maxlength="1000" required
            placeholder="What would you like to share?" aria-describedby="post-length"></textarea>
        <div class="form-actions">
            <span class="muted small" id="post-length">Up to 1,000 characters</span>
            <button type="submit">Share post</button>
        </div>
    </form>`;
}

function renderPost(post, detail = false) {
    const postId = escapeHtml(post._id);
    const authorName = escapeHtml(post.author.username);
    const authorLink = profileHref(post.author.username);
    const isEditing = post.isAuthor && state.editingPostId === post._id;
    const commentOpen = detail || state.openComments.has(post._id);
    const comments = state.comments[post._id] || [];

    return `<article class="post-card" id="post-${postId}">
        <header class="post-head">
            <a href="${authorLink}" aria-label="View @${authorName}'s profile">${avatar(post.author)}</a>
            <div>
                <a class="author-name" href="${authorLink}">@${authorName}</a>
                <span class="post-time"><a href="#/post/${postId}"><time datetime="${escapeHtml(post.createdAt)}">${escapeHtml(formatDate(post.createdAt))}</time></a></span>
            </div>
        </header>
        ${isEditing
            ? `<form class="inline-edit" data-form="post-edit" data-post-id="${postId}">
                <label class="sr-only" for="edit-post-${postId}">Edit post</label>
                <textarea id="edit-post-${postId}" name="content" maxlength="1000" required>${escapeHtml(post.content)}</textarea>
                <div class="form-actions">
                    <button class="secondary" type="button" data-action="cancel-post-edit">Cancel</button>
                    <button type="submit">Save changes</button>
                </div>
              </form>`
            : `<p class="post-content">${escapeHtml(post.content)}</p>`}
        <div class="post-actions">
            <button class="${post.likedByMe ? "liked" : ""}" type="button"
                data-action="like" data-post-id="${postId}" data-liked="${post.likedByMe}"
                ${state.user ? "" : 'aria-label="Log in to like this post"'}>
                ${post.likedByMe ? "Liked" : "Like"} (${post.likeCount})
            </button>
            <button type="button" data-action="comments" data-post-id="${postId}"
                aria-expanded="${commentOpen}">
                ${commentOpen ? "Hide" : "Comments"} (${post.commentCount})
            </button>
            ${post.isAuthor ? `<button class="secondary" type="button" data-action="edit-post" data-post-id="${postId}">Edit</button>
                <button class="danger" type="button" data-action="delete-post" data-post-id="${postId}">Delete</button>` : ""}
        </div>
        ${commentOpen ? renderComments(post, comments) : ""}
    </article>`;
}

function renderComments(post, comments) {
    const postId = escapeHtml(post._id);
    let commentContent;
    if (state.commentsLoading.has(post._id)) {
        commentContent = `<p class="muted small" role="status">Loading comments...</p>`;
    } else if (comments.length === 0) {
        commentContent = `<p class="muted small">No comments yet. Start the conversation.</p>`;
    } else {
        commentContent = `<div class="comment-list">${comments.map((comment) => {
            const commentId = escapeHtml(comment._id);
            const authorLink = profileHref(comment.author.username);
            const isAuthor = Boolean(state.user && comment.author._id === state.user.id);
            const editing = isAuthor && state.editingCommentId === comment._id;
            return `<article class="comment">
                <a href="${authorLink}" aria-label="View @${escapeHtml(comment.author.username)}'s profile">${avatar(comment.author)}</a>
                <div>
                    <div class="comment-bubble">
                        <a class="author-name" href="${authorLink}">@${escapeHtml(comment.author.username)}</a>
                        ${editing
                            ? `<form class="inline-edit" data-form="comment-edit" data-comment-id="${commentId}" data-post-id="${postId}">
                                <label class="sr-only" for="edit-comment-${commentId}">Edit comment</label>
                                <textarea id="edit-comment-${commentId}" name="content" maxlength="500" required>${escapeHtml(comment.content)}</textarea>
                                <div class="form-actions">
                                    <button class="secondary" type="button" data-action="cancel-comment-edit">Cancel</button>
                                    <button type="submit">Save</button>
                                </div>
                              </form>`
                            : `<p>${escapeHtml(comment.content)}</p>`}
                    </div>
                    ${isAuthor ? `<div class="comment-controls">
                        <button type="button" data-action="edit-comment" data-comment-id="${commentId}" data-post-id="${postId}">Edit</button>
                        <button type="button" data-action="delete-comment" data-comment-id="${commentId}" data-post-id="${postId}">Delete</button>
                    </div>` : ""}
                </div>
            </article>`;
        }).join("")}</div>`;
    }

    const form = state.user
        ? `<form class="comment-form" data-form="comment-create" data-post-id="${postId}">
            <label class="sr-only" for="comment-${postId}">Write a comment</label>
            <textarea id="comment-${postId}" name="content" maxlength="500" rows="2" required placeholder="Write a comment..."></textarea>
            <button type="submit">Comment</button>
          </form>`
        : `<p class="muted small"><a href="#/login">Log in</a> to join the conversation.</p>`;
    return `<section class="comment-panel" aria-label="Comments">
        ${commentContent}
        ${form}
    </section>`;
}

function renderFeed() {
    const posts = state.posts.length
        ? `<div class="post-list">${state.posts.map((post) => renderPost(post)).join("")}</div>`
        : renderEmpty("A fresh start", "There are no posts yet. Be the first to share something.");
    appContent.innerHTML = `<div class="layout">
        <section class="main-column" aria-labelledby="feed-title">
            <div class="hero">
                <p class="eyebrow">A LITTLE MORE CONNECTED</p>
                <h1>Good things start with hello.</h1>
                <p>Share a thought, meet a neighbor, and keep up with the people who make your day.</p>
            </div>
            ${renderComposer()}
            <h2 id="feed-title">Latest posts</h2>
            ${posts}
        </section>
        <aside class="side-column" aria-label="About Socially">
            <section class="card side-card">
                <h2>Your corner of the internet</h2>
                <p class="muted">A simple place to post, talk, and follow the people you care about.</p>
            </section>
            <section class="card side-card">
                <h3>New around here?</h3>
                <p class="muted">Find people in Explore, then visit their profile to follow along.</p>
                <a href="#/explore">Explore people</a>
            </section>
        </aside>
    </div>`;
}

function renderAuth(register) {
    const title = register ? "Make yourself at home" : "Welcome back";
    appContent.innerHTML = `<section class="card auth-card">
        <p class="eyebrow">SOCIALLY</p>
        <h1>${title}</h1>
        <p class="muted">${register
            ? "Create an account to share posts and follow people."
            : "Log in to share a post and catch up with your community."}</p>
        <form data-form="${register ? "register" : "login"}">
            ${register ? `<div class="form-field">
                <label for="auth-username">Username</label>
                <input id="auth-username" name="username" type="text" minlength="3" maxlength="24"
                    pattern="[A-Za-z0-9_]+" autocomplete="username" required>
                <span class="muted small">3-24 letters, numbers, or underscores.</span>
            </div>` : ""}
            <div class="form-field">
                <label for="auth-email">Email</label>
                <input id="auth-email" name="email" type="email" maxlength="254"
                    autocomplete="email" required>
            </div>
            <div class="form-field">
                <label for="auth-password">Password</label>
                <input id="auth-password" name="password" type="password" minlength="${register ? 10 : 1}"
                    maxlength="128" autocomplete="${register ? "new-password" : "current-password"}" required>
                ${register ? '<span class="muted small">Use at least 10 characters.</span>' : ""}
            </div>
            <button type="submit">${register ? "Create account" : "Log in"}</button>
        </form>
        <p class="auth-switch">${register
            ? 'Already have an account? <a href="#/login">Log in</a>.'
            : 'New to Socially? <a href="#/register">Create an account</a>.'}</p>
    </section>`;
}

function renderProfile(profile) {
    const user = profile.user;
    const isEditing = state.editingProfile && profile.isMe;
    const profileImageUrl = user.profileImageUrl || "";
    const profileContent = isEditing
        ? `<form data-form="profile-edit" class="profile-edit-form">
            <div class="form-field">
                <label for="profile-username">Username</label>
                <input id="profile-username" name="username" type="text" minlength="3" maxlength="24"
                    pattern="[A-Za-z0-9_]+" value="${escapeHtml(user.username)}" required>
            </div>
            <div class="form-field">
                <label for="profile-bio">Bio</label>
                <textarea id="profile-bio" name="bio" maxlength="160">${escapeHtml(user.bio)}</textarea>
            </div>
            <div class="form-field">
                <label for="profile-image">Profile image URL (HTTPS)</label>
                <input id="profile-image" name="profileImageUrl" type="url" maxlength="2048"
                    value="${escapeHtml(profileImageUrl)}" placeholder="https://example.com/image.jpg">
            </div>
            <div class="form-actions">
                <button class="secondary" type="button" data-action="cancel-profile-edit">Cancel</button>
                <button type="submit">Save profile</button>
            </div>
          </form>`
        : `<p class="profile-bio">${escapeHtml(user.bio || "This person has not added a bio yet.")}</p>`;
    const followAction = profile.isMe
        ? `<button class="secondary" type="button" data-action="edit-profile">Edit profile</button>`
        : `<button type="button" data-action="follow" data-user-id="${escapeHtml(user.id)}"
            data-following="${profile.isFollowing}">${profile.isFollowing ? "Following" : "Follow"}</button>`;

    let connections = "";
    if (state.connectionMode) {
        const list = state.connectionLoading
            ? `<span class="muted small" role="status">Loading ${state.connectionMode}...</span>`
            : state.connectionUsers.length
            ? state.connectionUsers.map((person) => `<a href="${profileHref(person.username)}">@${escapeHtml(person.username)}</a>`).join("")
            : `<span class="muted small">No ${state.connectionMode} yet.</span>`;
        connections = `<div class="connection-list" aria-live="polite">${list}</div>`;
    }
    const posts = profile.posts.length
        ? `<div class="post-list">${profile.posts.map((post) => renderPost(post)).join("")}</div>`
        : renderEmpty("No posts yet", "Posts shared by this user will show up here.");

    appContent.innerHTML = `<div class="layout">
        <section class="main-column">
            <section class="profile-card">
                <div class="profile-heading">
                    ${avatar(user, true)}
                    <div>
                        <p class="eyebrow">COMMUNITY PROFILE</p>
                        <h1>@${escapeHtml(user.username)}</h1>
                        <p class="muted small">Joined ${escapeHtml(formatDate(user.createdAt))}</p>
                    </div>
                </div>
                ${profileContent}
                <div class="profile-actions">${followAction}</div>
                <div class="connection-stats">
                    <button type="button" data-action="connections" data-direction="followers">
                        <strong>${profile.followerCount}</strong> followers
                    </button>
                    <button type="button" data-action="connections" data-direction="following">
                        <strong>${profile.followingCount}</strong> following
                    </button>
                </div>
                ${connections}
            </section>
            <h2>Posts</h2>
            ${posts}
        </section>
        <aside class="side-column">
            <section class="card side-card">
                <h2>Say hello</h2>
                <p class="muted">Join the conversation by leaving a thoughtful comment on a post.</p>
                <a href="#/feed">Visit the feed</a>
            </section>
        </aside>
    </div>`;
}

function renderExplore() {
    const results = state.exploreQuery
        ? state.exploreResults.length
            ? `<div class="user-list">${state.exploreResults.map((user) => `<article class="user-result">
                <a href="${profileHref(user.username)}">${avatar(user)}</a>
                <div class="user-info">
                    <a class="author-name" href="${profileHref(user.username)}">@${escapeHtml(user.username)}</a>
                    <p>${escapeHtml(user.bio || "No bio yet.")}</p>
                </div>
                <a class="button secondary" href="${profileHref(user.username)}">View</a>
              </article>`).join("")}</div>`
            : renderEmpty("No people found", "Try another username.")
        : renderEmpty("Find your people", "Search by username to discover people on Socially.");

    appContent.innerHTML = `<section class="card">
        <p class="eyebrow">EXPLORE</p>
        <h1>Find your people</h1>
        <p class="muted">Search for a username and visit a profile to see their posts and follow them.</p>
        <form class="search-form" data-form="user-search" role="search">
            <label class="sr-only" for="user-search">Search usernames</label>
            <input id="user-search" name="search" type="search" minlength="1" maxlength="32"
                value="${escapeHtml(state.exploreQuery)}" placeholder="Try a username">
            <button type="submit">Search</button>
        </form>
        ${results}
    </section>`;
}

function parseRoute() {
    const raw = location.hash.startsWith("#/") ? location.hash.slice(2) : "feed";
    const [path, query] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    try {
        if (parts[0] === "register") return { name: "register" };
        if (parts[0] === "login") return { name: "login" };
        if (parts[0] === "explore") {
            return { name: "explore", search: new URLSearchParams(query || "").get("q") || "" };
        }
        if (parts[0] === "profile" && parts[1]) {
            return { name: "profile", username: decodeURIComponent(parts[1]) };
        }
        if (parts[0] === "post" && parts[1]) {
            return { name: "post", postId: decodeURIComponent(parts[1]) };
        }
    } catch {
        return { name: "not-found" };
    }
    if (parts.length === 0 || parts[0] === "feed") return { name: "feed" };
    return { name: "not-found" };
}

async function renderPage() {
    const version = ++state.renderVersion;
    const route = parseRoute();
    renderNavigation();

    if (route.name === "login" || route.name === "register") {
        renderAuth(route.name === "register");
        return;
    }
    if (route.name === "not-found") {
        renderLoadError("That page does not exist.");
        return;
    }

    renderLoading();
    try {
        if (route.name === "feed") {
            const data = await request("/api/posts?limit=50");
            if (version !== state.renderVersion) return;
            state.posts = data.posts;
            renderFeed();
            return;
        }
        if (route.name === "explore") {
            state.exploreQuery = route.search;
            if (state.exploreQuery) {
                const data = await request(
                    `/api/users?search=${encodeURIComponent(state.exploreQuery)}`
                );
                if (version !== state.renderVersion) return;
                state.exploreResults = data.users;
            } else {
                state.exploreResults = [];
            }
            renderExplore();
            return;
        }
        if (route.name === "profile") {
            const data = await request(
                `/api/users/${encodeURIComponent(route.username)}`
            );
            if (version !== state.renderVersion) return;
            state.profileData = data;
            renderProfile(data);
            return;
        }
        if (route.name === "post") {
            const data = await request(`/api/posts/${encodeURIComponent(route.postId)}`);
            if (version !== state.renderVersion) return;
            state.posts = [data.post];
            state.openComments.add(data.post._id);
            const comments = await request(`/api/posts/${encodeURIComponent(route.postId)}/comments`);
            if (version !== state.renderVersion) return;
            state.comments[data.post._id] = comments.comments;
            appContent.innerHTML = `<div class="main-column">
                <p><a href="#/feed">&larr; Back to feed</a></p>
                <h1>Post</h1>
                ${renderPost(data.post, true)}
            </div>`;
        }
    } catch (error) {
        if (version !== state.renderVersion) return;
        renderLoadError(error.message);
    }
}

async function loadComments(postId) {
    if (state.commentsLoading.has(postId)) return;
    state.commentsLoading.add(postId);
    renderPage();
    try {
        const data = await request(`/api/posts/${encodeURIComponent(postId)}/comments`);
        state.comments[postId] = data.comments;
    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        state.commentsLoading.delete(postId);
        renderPage();
    }
}

async function handleClick(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const { action, postId, commentId } = button.dataset;

    try {
        if (action === "logout") {
            await request("/api/auth/logout", { method: "POST" });
            state.user = null;
            state.editingPostId = null;
            state.editingCommentId = null;
            renderNavigation();
            location.hash = "#/feed";
            showMessage("You have been logged out.");
            await renderPage();
            return;
        }
        if (action === "retry") {
            await renderPage();
            return;
        }
        if (action === "like") {
            if (!state.user) {
                location.hash = "#/login";
                return;
            }
            const method = button.dataset.liked === "true" ? "DELETE" : "POST";
            await request(`/api/posts/${encodeURIComponent(postId)}/like`, { method });
            await renderPage();
            return;
        }
        if (action === "comments") {
            if (state.openComments.has(postId)) {
                state.openComments.delete(postId);
                await renderPage();
            } else {
                state.openComments.add(postId);
                await loadComments(postId);
            }
            return;
        }
        if (action === "edit-post") {
            state.editingPostId = postId;
            await renderPage();
            return;
        }
        if (action === "cancel-post-edit") {
            state.editingPostId = null;
            await renderPage();
            return;
        }
        if (action === "delete-post") {
            if (!window.confirm("Delete this post and its comments and likes?")) return;
            await request(`/api/posts/${encodeURIComponent(postId)}`, { method: "DELETE" });
            state.editingPostId = null;
            showMessage("Post deleted.");
            await renderPage();
            return;
        }
        if (action === "edit-comment") {
            state.editingCommentId = commentId;
            await renderPage();
            return;
        }
        if (action === "cancel-comment-edit") {
            state.editingCommentId = null;
            await renderPage();
            return;
        }
        if (action === "delete-comment") {
            await request(`/api/comments/${encodeURIComponent(commentId)}`, { method: "DELETE" });
            showMessage("Comment deleted.");
            await loadComments(postId);
            return;
        }
        if (action === "follow") {
            const method = button.dataset.following === "true" ? "DELETE" : "POST";
            await request(`/api/users/${encodeURIComponent(button.dataset.userId)}/follow`, { method });
            await renderPage();
            return;
        }
        if (action === "edit-profile") {
            state.editingProfile = true;
            renderProfile(state.profileData);
            return;
        }
        if (action === "cancel-profile-edit") {
            state.editingProfile = false;
            renderProfile(state.profileData);
            return;
        }
        if (action === "connections") {
            const direction = button.dataset.direction;
            state.connectionMode = direction;
            state.connectionUsers = [];
            state.connectionLoading = true;
            renderProfile(state.profileData);
            try {
                const data = await request(
                    `/api/users/${encodeURIComponent(state.profileData.user.username)}/${direction}`
                );
                state.connectionUsers = data.users;
            } finally {
                state.connectionLoading = false;
                renderProfile(state.profileData);
            }
        }
    } catch (error) {
        showMessage(error.message, "error");
    }
}

function formValue(form, name) {
    return new FormData(form).get(name);
}

async function handleSubmit(event) {
    const form = event.target;
    if (!form.matches("form[data-form]")) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    try {
        const formType = form.dataset.form;
        if (formType === "register" || formType === "login") {
            const data = await request(`/api/auth/${formType}`, {
                method: "POST",
                body: JSON.stringify({
                    username: formValue(form, "username"),
                    email: formValue(form, "email"),
                    password: formValue(form, "password"),
                }),
            });
            state.user = data.user;
            state.editingPostId = null;
            state.editingCommentId = null;
            renderNavigation();
            location.hash = "#/feed";
            showMessage(formType === "register" ? "Welcome to Socially!" : "You are logged in.");
            await renderPage();
            return;
        }
        if (formType === "post-create") {
            await request("/api/posts", {
                method: "POST",
                body: JSON.stringify({ content: formValue(form, "content") }),
            });
            showMessage("Your post is live.");
            await renderPage();
            return;
        }
        if (formType === "post-edit") {
            await request(`/api/posts/${encodeURIComponent(form.dataset.postId)}`, {
                method: "PATCH",
                body: JSON.stringify({ content: formValue(form, "content") }),
            });
            state.editingPostId = null;
            showMessage("Post updated.");
            await renderPage();
            return;
        }
        if (formType === "comment-create") {
            const postId = form.dataset.postId;
            await request(`/api/posts/${encodeURIComponent(postId)}/comments`, {
                method: "POST",
                body: JSON.stringify({ content: formValue(form, "content") }),
            });
            showMessage("Comment added.");
            await loadComments(postId);
            return;
        }
        if (formType === "comment-edit") {
            const commentId = form.dataset.commentId;
            await request(`/api/comments/${encodeURIComponent(commentId)}`, {
                method: "PATCH",
                body: JSON.stringify({ content: formValue(form, "content") }),
            });
            state.editingCommentId = null;
            showMessage("Comment updated.");
            await loadComments(form.dataset.postId);
            return;
        }
        if (formType === "profile-edit") {
            const data = await request("/api/users/me", {
                method: "PATCH",
                body: JSON.stringify({
                    username: formValue(form, "username"),
                    bio: formValue(form, "bio"),
                    profileImageUrl: formValue(form, "profileImageUrl"),
                }),
            });
            state.user = { ...state.user, ...data.user };
            state.editingProfile = false;
            state.profileData = null;
            renderNavigation();
            location.hash = profileHref(data.user.username);
            showMessage("Profile saved.");
            await renderPage();
            return;
        }
        if (formType === "user-search") {
            const search = String(formValue(form, "search") || "").trim();
            state.exploreQuery = search;
            location.hash = `#/explore${search ? `?q=${encodeURIComponent(search)}` : ""}`;
            await renderPage();
        }
    } catch (error) {
        showMessage(error.message, "error");
    } finally {
        if (button && button.isConnected) button.disabled = false;
    }
}

async function initialize() {
    try {
        const health = await request("/api/health");
        if (apiStatus) apiStatus.textContent = health.status === "ok" ? "Server online" : "Server ready";
    } catch (error) {
        if (apiStatus) apiStatus.textContent = "Server unavailable";
    }
    try {
        const data = await request("/api/auth/me");
        state.user = data.user;
    } catch (error) {
        showMessage(error.message, "error");
    }
    renderNavigation();
    await renderPage();
}

appContent.addEventListener("click", handleClick);
accountNav.addEventListener("click", handleClick);
appContent.addEventListener("submit", handleSubmit);
document.addEventListener("click", (event) => {
    if (event.target.closest('a[href^="#/"]')) clearMessage();
});
window.addEventListener("hashchange", () => {
    state.connectionMode = null;
    state.connectionUsers = [];
    state.connectionLoading = false;
    renderPage();
});

initialize();
