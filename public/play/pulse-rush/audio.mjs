export class Music {
 async init(){if(!this.ctx){this.ctx=new AudioContext();this.master=this.ctx.createGain();this.master.gain.value=.65;const compressor=this.ctx.createDynamicsCompressor();this.master.connect(compressor);compressor.connect(this.ctx.destination);this.noise=this.ctx.createBuffer(1,this.ctx.sampleRate,this.ctx.sampleRate);const d=this.noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}await this.ctx.resume();}
 start(chart){this.chart=chart;this.index=0;this.origin=this.ctx.currentTime+.15;this.active=true;}
 get time(){return this.ctx?this.ctx.currentTime-this.origin:0;}
 tick(){if(!this.active)return;while(this.index<this.chart.events.length&&this.chart.events[this.index].time<this.time+.16){const e=this.chart.events[this.index++];if(e.time>=this.time-.05)this.play(e,this.origin+e.time);}}
 play(e,at){const c=this.ctx,g=c.createGain();let source;const length=e.duration;
 if(e.voice==='snare'||e.voice==='hat'){source=c.createBufferSource();source.buffer=this.noise;const filter=c.createBiquadFilter();filter.type='highpass';filter.frequency.value=e.voice==='hat'?8000:1600;source.connect(filter);filter.connect(g);}else{source=c.createOscillator();source.type=e.voice==='lead'?(this.chart.songId===5?'square':'triangle'):e.voice==='bass'?'triangle':'sine';const f=440*2**((e.midi-69)/12);source.frequency.setValueAtTime(e.voice==='kick'?145:f,at);if(e.voice==='kick')source.frequency.exponentialRampToValueAtTime(40,at+.15);source.connect(g);}
 g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(e.velocity,at+.008);g.gain.exponentialRampToValueAtTime(.0001,at+length);g.connect(this.master);source.start(at);source.stop(at+length+.02);source.onended=()=>{source.disconnect();g.disconnect();};}
 async pause(){this.active=false;await this.ctx.suspend();}
 async resume(){await this.ctx.resume();this.active=true;}
 async stop(){this.active=false;if(this.ctx){await this.ctx.close();this.ctx=null;}}
 volume(value){if(this.master)this.master.gain.value=value;}
}
