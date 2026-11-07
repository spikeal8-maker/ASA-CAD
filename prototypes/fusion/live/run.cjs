/* Isolated Fusion integration build: unchanged product App and exact geometry path. */
const path=require('node:path');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..');
const req=createRequire(path.join(root,'vendor/toubkal/package.json'));
const {rspack,NormalModuleReplacementPlugin,HtmlRspackPlugin}=req('@rspack/core');
const base=require(path.join(root,'build/rspack.asa.config.cjs'));
const swaps={CadShellTop:'LiveTop.tsx',CadShellMain:'LiveMain.tsx',CadShellBottom:'LiveBottom.tsx',ViewportReferenceLayer:'LiveReferenceLayer.ts',SketchEditingStage:'LiveSketchStage.tsx',useSketchLineTool:'LiveSketchLineTool.ts'};
const replacement=new NormalModuleReplacementPlugin(/(CadShellTop|CadShellMain|CadShellBottom|ViewportReferenceLayer|SketchEditingStage|useSketchLineTool|OrbitControls\.js|^three$)/,r=>{
 const ctx=r.context.replaceAll('\\','/');
 if(!ctx.includes('/src/web'))return;
 const name=r.request.split('/').pop();
 if(swaps[name])r.request=path.join(__dirname,swaps[name]);
 if(r.request==='three/examples/jsm/controls/OrbitControls.js')r.request=path.join(__dirname,'LiveOrbitControls.ts');
 if(r.request==='three'&&ctx.endsWith('/src/web'))r.request=path.join(__dirname,'LiveThree.ts');
});
const serve=process.argv.includes('serve');
const config={...base,mode:'development',devtool:'source-map',entry:path.join(__dirname,'entry.tsx'),
 output:{...base.output,path:path.join(root,'dist/fusion-live'),filename:'[name].js',chunkFilename:'[name].js',cssFilename:'[name].css',cssChunkFilename:'[name].css'},
 plugins:[new HtmlRspackPlugin({template:path.join(__dirname,'index.html')}),replacement],
 devServer:{...base.devServer,host:'127.0.0.1',port:Number(process.env.ASA_FUSION_PORT||8093),hot:false,liveReload:false,client:false},
};
const compiler=rspack(config);
if(serve){
 const m=req('@rspack/dev-server');const Server=m.RspackDevServer||m.default||m;
 const server=new Server(config.devServer,compiler);
 server.start().catch(e=>{console.error(e);process.exitCode=1;});
 async function stop(){await server.stop();compiler.close(()=>process.exit(0));}
 process.on('SIGINT',stop);process.on('SIGTERM',stop);
}else compiler.run((err,stats)=>{if(err)console.error(err);if(stats)console.log(stats.toString({colors:false,chunks:false,modules:false}));compiler.close(()=>{process.exitCode=err||!stats||stats.hasErrors()?1:0;});});
