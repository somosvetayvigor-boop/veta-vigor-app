const fs = require('fs');

fetch('https://rhxseahupujjqhcrthpf.supabase.co/rest/v1/frontend_errors?select=*&order=created_at.desc&limit=3', {
  headers: {
    'apikey': 'sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF',
    'Authorization': 'Bearer sb_publishable_C8Eau5WrFnkO7agz39JvSw_sqvX2tkF'
  }
})
.then(res => res.json())
.then(data => console.log(JSON.stringify(data, null, 2)))
.catch(err => console.error(err));
