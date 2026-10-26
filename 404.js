// Addresses are case-sensitive on GitHub Pages. Before showing "not found",
// retry the same address in lowercase, so michaelsturrup.com/OathofStur reaches
// /oathofstur/. Already-lowercase addresses fall through to the page as usual.
const lower = location.pathname.toLowerCase();
if (lower !== location.pathname) location.replace(lower + location.search + location.hash);
