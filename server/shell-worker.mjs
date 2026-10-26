export default {async fetch(request,env){
 if(new URL(request.url).pathname.startsWith('/api/'))return env.BACKEND.fetch(request);
 return env.ASSETS.fetch(request);
}};
