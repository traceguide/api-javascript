// This function is copied directly from https://github.com/litejs/browser-cookie-lite.
// It is licensed under the MIT License and authored by Lauri Rooden.
function cookie(name, value, ttl, path, domain, secure) {
    if (arguments.length > 1) {
        var newCookie = name + "=" + encodeURIComponent(value) +
            (ttl ? "; expires=" + new Date(+new Date()+(ttl*1000)).toUTCString() : "") +
            (path   ? "; path=" + path : "") +
            (domain ? "; domain=" + domain : "") +
            (secure ? "; secure" : "");
        document.cookie = newCookie;
        return newCookie;
    }
    return decodeURIComponent((("; "+document.cookie).split("; "+name+"=")[1]||"").split(";")[0]);
}

module.exports = {
    cookie : cookie,
};
