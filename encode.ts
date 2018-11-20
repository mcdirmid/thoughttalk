
namespace en {
   type Pattern = pt.Pattern;
   type Channel = pt.Channel;
   type Seq = pt.Seq;
   type Root = pt.Root;

   export abstract class Operation extends Object {
      get adbg() { return this.name; }
      abstract get name(): string;
      abstract get args(): number[];
      reset() { }
      abstract transform(p: Root, oprs: [Operation, Root][], commit: boolean): Root;
      toString() { return this.adbg; }
      abstract get channel(): Channel;
      get execChannels(): Channel[] { return [this.channel]; }
      get smallChannels(): Channel[] { return []; }
      get outChannels(): Channel[] { return []; }
      loopBack(code: Code): [Channel, Loop, Channel] { return null; }
      underline(p: pt.Root): number[] {
         let c = this.channel;
         let ret: number[] = [];
         for (let i of this.args) {
            let idx = i; //p.toGlobal(i, c);
            (idx >= 0).assert();
            ret.push(idx);
         }
         return ret;
      }
      commit(code: Code) { }
   }

   export abstract class EmptyStarOpt extends Operation {
      constructor(readonly channel: Channel, readonly idx: number) {
         super();
         (!channel.peers().isEmpty()).assert();
         //(idx.length == channel.peers().count() + 1).assert();
      }
      get args() { return [this.idx]; }
      underline(p: Root) {
         let ret = this.idx; // p.toGlobal(this.idx[0], this.channel);
         (ret >= 0).assert();
         return [ret];
      }
      transform(p: Root): Root {
         let peers = [this.channel].concat(this.channel.peers().toArray());
         let idx = this.idx;
         let [a, b] = p.elements[idx];
         if (b != this.channel || !this.check(a))
            return null;
         return p.setChannel(idx, 1, this.channel.nonLoopParent).merge();
      }
      get execChannels() { return this.channel.peers().toArray(); }
      abstract check(p: pt.Pattern): boolean;
   }
   export class EmptyStar extends EmptyStarOpt {
      get name() { return "empty"; }
      check(p: pt.Pattern) { return (p as pt.StarLike).isStarLike; }
      constructor(channel: Channel, idx: number) {
         super(channel, idx)
      }
   }
   export class EmptyOpt extends EmptyStarOpt {
      get name() { return "empty"; }
      check(p: pt.Pattern) { return p instanceof pt.Opt; }
      constructor(channel: Channel, idx: number) {
         super(channel, idx)
      }
   }

   export class MakeOpt extends Operation {
      get execChannels() { return [this.channel].concat(...this.channel.peers()); }
      constructor(readonly channel: Channel, readonly idx: number, readonly len: number) {
         super();
         (!channel.peers().isEmpty()).assert();
      }
      get args() { return [this.idx, this.len]; }
      underline(p: Root): number[] {
         let ret: number[] = [];
         let k = this.len;
         let idx = this.idx;
         while (true) {
            if (k == 0)
               return ret;
            if (idx >= p.elements.length)
               return null;
            let cn = p.elements[idx][1];
            if (!this.channel.isRelated(cn)) {
               idx += 1;
               continue;
            }
            if (cn != this.channel)
               return null;
            ret.push(idx);
            idx += 1;
            k -= 1;
         }
      }
      get name() { return "mk-opt"; }
      transform(p: Root): Root {
         let eS = p.elements.copy();
         let ul = this.underline(p);
         if (!ul)
            return null;
         let first = ul[0];
         {
            let at = first + 1;
            for (let j of ul.skip(1)) {
               if (j != at) {
                  let temp = eS[j];
                  eS[j] = eS[at];
                  eS[at] = temp;
               }
               at += 1;
            }
            (at == first + ul.length).assert();
         }
         let end = first + ul.length;
         let seq = new pt.Seq(...eS.slice(first, end).map(e => e[0]));
         let newOpt: pt.Opt = seq.children.length == 1 ? seq.children[0].opt() : seq.opt();
         eS.splice(first, end - first, [newOpt, this.channel.nonLoopParent]);
         return new pt.Root(...eS).merge();
      }
   }




   export class Swap extends Operation {
      get name() { return "swap"; }
      constructor(readonly channel: Channel, readonly idx: number, readonly jdx: number) {
         super();
      }
      get args() { return [this.idx, this.jdx]; }
      transform(p: Root): Root {
         let idx = this.idx;
         let jdx = this.jdx;
         (jdx > idx).assert();
         let args: [[number, number], [number, number]] = [[idx, 1], [jdx, 1]];
         p = p.splits(this.channel, args);
         idx = args[0][0];
         jdx = args[1][0];
         if (p.elements[idx][0].plength != 1 || p.elements[jdx][0].plength != 1)
            return null;
         p = p.swap(idx, jdx);
         p = p.merge();
         return p;
      }
   }
   export abstract class BranchOp extends Operation {
      get outChannels() { return this.out0; }
      get channel() { return this.outChannels[0].parent; }
      constructor(private readonly out0: Channel[]) {
         super();
         for (let c of out0)
            (c.parent == out0[0].parent).assert();
      }
   }
   export class PopLR extends BranchOp {
      get args() { return [this.idx]; }
      constructor(channels: Channel[], readonly idx: number, readonly dir: "left" | "right") {
         super(channels);
      }
      get name() { return "pop" + this.dir[0]; }
      transform(p: Root): Root {
         if (this.idx >= p.elements.length)
            return null;
         let [a, b] = p.elements[this.idx];
         if (b != this.channel)
            return null;
         let a0 = a as pt.StarLike;
         if (!a0.isStarLike)
            return null;
         let pS = a0.pop(this.dir, p);
         if (pS.length + 1 != this.outChannels.length)
            return null;
         let fS: [pt.Pattern, pt.Channel][] = [];
         for (let i = 0; i < pS.length; i += 1) {
            let [x, y] = pS[i];
            fS.push([x, this.outChannels[i]], [y, this.outChannels[i]]);
         }
         let eS = p.elements.copy();
         eS.splice(this.idx, 1, ...fS);
         return new pt.Root(...eS);
         /*
         let idx = this.idx; // p.toGlobal(this.idx, this.channel);
         let oldS = pt.bigX.star().seq();
         let newS = (this.dir == "left" ? pt.bigX.seq(oldS) : oldS.seq(pt.bigX));
         return p.exec(this.idx, this.outChannels[0], oldS, newS, [pt.RootUnify], true);
         */
      }
   }

   export class Poke extends BranchOp {
      get args() { return [this.idx]; }
      constructor(channels: Channel[], readonly idx: number) {
         super(channels);
      }
      get name() { return "poke"; }
      transform(p: Root): Root {
         let idx = this.idx; // p.toGlobal(this.idx, this.channel);
         let eS = p.elements.copy();
         if (idx >= eS.length)
            return null;
         let [a, b] = eS[idx];
         if (!(a instanceof pt.Opt) || b != this.channel)
            return null;
         if (a.child instanceof pt.Seq) {
            (a.child.children.length > 1).assert();
            let fS = a.child.children.map(a => [a, this.outChannels[0]] as [pt.Pattern, pt.Channel]);
            eS.splice(idx, 1, ...fS);
         } else {
            eS[idx] = [a.child, this.outChannels[0]];
         }
         return new pt.Root(...eS);
         //let oldS = pt.bigX.opt().seq();
         //let newS = pt.bigX.seq();
         //return p.exec(this.idx, this.outChannels[0], oldS, newS, [pt.RootUnify], true);
      }
   }
   export class Fork extends BranchOp {
      get args() { return [this.idx]; }
      constructor(channels: Channel[], readonly idx: number) {
         super(channels);
      }
      get name() { return "fork"; }
      transform(p: Root): Root {
         let idx = this.idx; // p.toGlobal(this.idx, this.channel);
         let [a, b] = p.elements[idx];
         if (!(a instanceof pt.Or) || b != this.channel || a.children.length != this.outChannels.length)
            return null;
         let eS: [pt.Pattern, pt.Channel][] = [];
         for (let i = 0; i < a.children.length; i += 1)
            eS.push([a.children[i], this.outChannels[i]]);
         return p.splice(idx, 1, new pt.Root(...eS));
      }
   }
   export class PushLR extends Operation {
      constructor(readonly channel: Channel, readonly idx: number, readonly dir: "left" | "right") {
         super();
      }
      get args() { return [this.idx]; }
      get name() { return "push" + this.dir[0]; }
      underline(p: pt.Root) {
         if (!p.elements[this.idx][1].isRelated(this.channel))
            return null;
         let at = this.idx + 1;
         while (true) {
            if (at == p.elements.length)
               return null;
            else if (p.elements[at][1].isRelated(this.channel))
               return [this.idx, at];
            else at += 1;
         }
      }
      transform(p: Root): Root {
         let ul = this.underline(p);
         if (!ul)
            return null;
         let [idx0, idx1] = ul;
         if (this.dir == "right") {
            // swap.
            let temp = idx0;
            idx0 = idx1;
            idx1 = temp;
         }
         let [sA0, sB] = p.elements[idx0];
         let [cA, cB] = p.elements[idx1];
         if (!this.channel.isUnder(sB) || !this.channel.isUnder(cB))
            return null;
         let sA = sA0 as pt.StarLike;
         if (!sA.isStarLike)
            return null;
         let nA = sA.push(this.dir, cA, p.filter(this.channel));
         if (!nA)
            return null;
         let p0 = p.slice(idx1.min(idx0), idx1.max(idx0) + 1);
         //(p0.elements.length == 2).assert();
         p0 = p0.split(this.channel, 0, p0.children.length);
         (p0.elements[0][1] == this.channel).assert();
         (p0.elements[1][1] == this.channel).assert();
         let eS = p0.elements.copy();
         eS.splice(0, 2, [nA, this.channel])
         let fS = p.elements.copy();
         fS.splice(idx1.min(idx0), idx1.max(idx0) + 1 - idx1.min(idx0), ...eS);
         return new pt.Root(...fS).merge();
         //return p.splice(idx1.min(idx0), idx1.dist(idx0) + 1, p1).merge();
      }
   }


   export class Loop extends Operation {
      get args() { return [] as number[]; }
      get name() { return "loop"; }
      //get adbg() { return "loop@" + this.channel; }
      constructor(readonly toLoop: pt.LoopChannel) {
         super();
      }
      get channel() { return this.toLoop.parent; }
      get outChannels() { return [this.toLoop]; }
      transform(p: Root): Root {
         let filter = p.filter(this.toLoop.parent);
         let eS: [pt.Pattern, Channel][] = [];
         for (let [a, b] of filter.elements) {
            if (b != this.toLoop.parent)
               return null;
            eS.push([a, this.toLoop]);
         }
         /*
         if (!this.toLoop.expected.equals(filter.asSeq(), false))
            return null;
         */
         let fS = this.toLoop.parent.peers().mapi(c => p.filter(c));
         for (let f of fS)
            eS.push(...f.elements);
         return new pt.Root(...eS).merge();
      }
   }
   export class Unloop extends Operation {
      get args() { return [] as number[]; }
      get execChannels() { return this.channel.peers().toArray(); }
      loopBack(code: Code): [Channel, Loop, Channel] {
         for (let [a, b] of code.operations) {
            if (a instanceof Loop && a.toLoop == this.loop)
               return [this.channel, a, this.loop];
         }
         throw new Error();
      }

      constructor(readonly channel: pt.Channel, readonly loop: pt.LoopChannel) {
         super();
         (this.channel != this.loop && this.channel.isUnder(this.loop).assert());
      }
      get name() { return "unloop"; }
      unify: pt.Unify;
      reset() { this.unify = null; }
      transform(p: Root, prevs: [Operation, Root][], commit: boolean): Root {
         let eS: [pt.Pattern, Channel][] = [];
         let fS: [pt.Pattern, Channel][] = [];
         for (let [a, b] of p.elements) {
            if (this.loop != b && this.loop.isUnder(b)) {
               fS.push([a, b]); // remains.
            } else {
               eS.push([a, b]);
               if (b != this.channel && b.isUnder(this.channel))
                  return null;
               else if (this.channel.isUnder(b)) {
                  b.isUnder(this.loop).assert();
                  let k = new pt.Root([a, b]).split(this.channel, 0, 1);
                  fS.push(...k.elements.skip(1));
               } else fS.push([a, b]);
            }
         }
         let q = new pt.Root(...eS).filter(this.channel);
         // find "loop"
         for (let i = 0; true; i += 1) {
            if (i >= prevs.length)
               return null;
            let [a, b] = prevs.last(i);
            if (a instanceof en.Loop && a.toLoop == this.loop) {
               let txt = b.asSeq().rectify(q.asSeq(), b);
               if (!txt)
                  return null;
               if (commit) {
                  (this.unify == null).assert();
                  this.unify = txt;
               }
               break;
            } else if (a instanceof en.Unloop && a.loop == this.loop)
               return null;
         }
         //if (!q.asSeq().equals(this.loop.expected, false))
         //   return null;
         let map = this.channel.eliminate();
         // if only one peer, will be upgraded to parent!
         for (let i = 0; i < fS.length; i += 1)
            fS[i][1] = map(fS[i][1]);
         return new pt.Root(...fS).merge();
      }
   }
   export class Lift extends Operation {
      get args() { return [] as number[]; }
      get name() { return "lift" + this.dir[0]; }
      constructor(readonly channel: pt.Channel, readonly loop: pt.LoopChannel, readonly dir: "front" | "back") {
         super();
         channel.isUnder(loop).assert();
      }
      underline(p: pt.Root): number[] {
         if (this.dir == "front") {
            for (let i = 0; i < p.elements.length; i += 1) {
               if (this.channel == p.elements[i][1])
                  return [i];
               else if (p.elements[i][1].isRelated(this.channel))
                  return null;
            }
            return null;
         }
         (this.dir == "back").assert();
         for (let i = p.elements.length - 1; i >= 0; i -= 1) {
            if (this.channel == p.elements[i][1])
               return [i];
            else if (p.elements[i][1].isRelated(this.channel))
               return null;
         }
         return null;
      }
      transform(p: Root): Root {
         let ul = this.underline(p);
         if (!ul)
            return null;
         let [idx] = ul;
         if (idx < 0)
            return null;
         let eS = p.elements.copy();
         {
            let jdx = this.dir == "front" ? 0 : p.elements.length - 1;
            if (idx != jdx) {
               // swap them.
               let temp = eS[idx];
               eS[idx] = eS[jdx];
               eS[jdx] = temp;
               idx = jdx;
            }
         }
         let [a, b] = eS[idx];
         if (b != this.channel)
            return null;
         let into = a.lift(this.dir, p);
         if (!into)
            return null;
         eS[idx] = [into, this.loop.parent];
         return new pt.Root(...eS);
      }

   }
   export class Return extends Operation {
      get args(): number[] { return []; }
      get channel() { return pt.RootChannel; }
      get name() { return "return"; }
      get execChannels(): pt.Channel[] { return []; }
      get smallChannels() { return super.execChannels; }
      private constructor() { super(); }
      transform(p: pt.Root) {
         for (let e of p.elements)
            if (e[1] != pt.RootChannel)
               return null;
         return p;
      }
      commit(code: en.Code) {
         code.output = code.operations.last()[1].asSeq();
      }
      static readonly Instance = new Return();
   }


   export class Code extends Operation {
      name: string = "???";
      output: Seq;
      readonly operations: [Operation, Root][] = [];
      push(operation: Operation) {
         let prev = this.operations.length == 0 ? pt.Root.make(this.input) : this.operations.last()[1];
         let next = operation.transform(prev, this.operations, true);
         if (next == null || !next.isValid()) {
            next = operation.transform(prev, this.operations, false);
         }
         (next != null).assert();
         this.operations.push([operation, next]);
      }
      constructor(name: string, input: Seq, output?: Seq) {
         super();
         this.name = name;
         //this.input = input;
         this.output = output ? output : new pt.Seq();
         this.operations.push([this, pt.Root.make(...input.children)])
      }
      get input() {
         return this.operations[0][1].asSeq();
      }
      set input(value: Seq) {
         (this.operations.length == 1).assert();
         this.operations[0] = [this, pt.Root.make(...value.children)];
      }

      recompute() {
         let rt = pt.Root.Empty;
         for (let i = 0; i < this.operations.length; i += 1) {
            this.operations[i][0].reset();
            rt = this.operations[i][0].transform(rt, this.operations.slice(0, i), true);
            (rt != null).assert();
            this.operations[i][1] = rt;
         }
         return rt;
      }


      setOutput(): void {
         this.output = this.recompute().asSeq();
      }
      get channel() { return pt.RootChannel; }
      get args(): number[] { return []; }
      transform(p: pt.Root) {
         p.elements.isEmpty().assert();
         return pt.Root.make(...this.input.children);
      }
   }


   export type Option = en.Operation;
   export class UserOptions {
      readonly dict = new Map<string, Code[]>();
      readonly active = new Set<Code>();
      has(code: Code) { return this.active.has(code); }

      add(code: Code) {
         (!this.active.has(code)).assert();
         this.active.add(code);
         this.dict.getOrSet(code.input.hashInput(), () => []).push(code);
      }
      delete(code: Code) {
         this.active.has(code).assert();
         this.active.delete(code);
         this.dict.get(code.input.hashInput()).delete(code).assert();
      }
   }
   export class Call extends Operation {
      readonly txt: pt.Unify;
      updatedTxt: pt.Unify;
      get args() { return [this.idx]; }
      constructor(
         readonly code: Code, readonly channel: Channel, readonly idx: number,
         binds: [pt.Term, pt.Pattern][] | pt.Unify, readonly rev: boolean) {
         super();
         if (binds instanceof pt.Unify)
            this.txt = binds;
         else {
            let txt0 = pt.RootUnify;
            for (let [a, b] of binds)
               txt0 = txt0.bindTerm(a, b);
            this.txt = txt0;
         }
         //this.updatedTxt = this.txt.doConsolidate();

      }
      underline(p: pt.Root): number[] {
         let ret: number[] = [];
         for (let i = 0; i < this.code.input.children.length; i += 1)
            ret.push(this.idx + i);
         return ret;
      }

      get name() { return this.code.name + (this.rev ? "-rev" : ""); }
      reset() { this.updatedTxt = null; }
      transform(p: Root, prevs: [Operation, pt.Root][], commit: boolean): Root {
         // isolate first.
         let len = this.code.input.children.length;
         let q: pt.Root;
         {
            let jdx = this.idx;
            let len0 = len;
            while (true) {
               if (len0 == 0)
                  break;
               else if (jdx == p.elements.length)
                  return null;
               else if (this.channel.isUnder(p.elements[jdx][1])) {
                  len0 -= 1;
                  jdx += 1;
               } else jdx += 1;
            }

            q = p.split(this.channel, this.idx, jdx - this.idx);
         }
         let q0 = q.slice(this.idx, this.idx + len);
         q0.elements.every(([a, b]) => b == this.channel).assert();
         if (this.rev)
            q0 = q0.reverse();
         let txtS =
            this.code.input.unify(
               q0.asSeq(), this.txt,
               pt.Root.make(...this.code.input.children)
            );
         if (txtS.length != 1)
            return null;
         let [txt] = txtS;
         this.code.input.replace(txt).equals(q0.asSeq()).assert();
         let output = this.code.output.replace(txt);
         if (output == null)
            return null;
         if (this.rev)
            output = output.reverse();
         let output0 =
            new pt.Root(...output.children.map
               (c => [c, this.channel] as [pt.Pattern, pt.Channel]));
         if (this.idx > 0)
            true.assert();
         q = q.splice(this.idx, len, output0);
         let ret = q.merge();
         if (commit) {
            (this.updatedTxt == null).assert();
            this.updatedTxt = txt.doConsolidate();
            let idx = this.updatedTxt.adbg.indexOf("out");
            if (idx >= 0)
               true.assert();
         }
         return ret;
      }
   }

}
namespace en {
   /*
   export class Pivot extends Operation {
      constructor(readonly idx: number, readonly channel: pt.Channel, readonly indicies : number[][]) {
         super();
      }
      get args() { return [this.idx]; }
      get name() { return "pivot"; }
      transform(p: pt.Root): pt.Root {
         {
            let [a, b] = p.elements[this.idx];
            if (b != this.channel)
               return null;
            if (a instanceof pt.Term || a instanceof pt.Subscript) { }
            else return null;
         }
         let xx = p.pivot(this.idx);
         return xx ? xx[0] : null;
      }
   }
   */
}
namespace pt {

   export interface Root {
      options(idx: number, db: en.UserOptions, oprs: [en.Operation, pt.Root][]): en.Option[];
   }
   export interface Pattern {
      options(idxS: number[], root: Root, oprs: [en.Operation, pt.Root][]): en.Option[];
   }


   Root.prototype.options = function (idx, db, oprs) {
      let self = this as Root;
      if (oprs.last()[0] instanceof en.Return)
         return [];

      let used = new Set(self.liveNow.mapi(a => a.name));
      let ret: en.Option[] = [];


      let [p, cn] = self.elements[idx];
      let canBranch = true;
      for (let [a, b] of self.elements) {
         if (b.isUnder(cn) && b != cn)
            canBranch = false;
      }


      if ((p as StarLike).isStarLike) {
         if (canBranch) {
            let kS = selectNewChannels(used, cn, 2);
            let left = new en.PopLR(kS, idx, "left");
            let right = new en.PopLR(kS, idx, "right");
            if (left.transform(self) != null)
               ret.push(left);
            if (right.transform(self) != null)
               ret.push(right);
         }
         if (!cn.isLoop && !cn.peers().isEmpty())
            ret.push(new en.EmptyStar(cn, idx));
      }
      /*
      if (p instanceof Term || p instanceof Subscript) {
         let xx = self.pivot(idx);
         if (xx) {
            let op = new en.Pivot(idx, cn, xx[1]);
            ret.push(op);
         }
      }
      */


      if (p instanceof Opt) {
         if (canBranch) {
            let kS = selectNewChannels(used, cn, 2);
            ret.push(new en.Poke(kS, idx));
         }
         if (!cn.isLoop && !cn.peers().isEmpty())
            ret.push(new en.EmptyOpt(cn, idx));
      }
      if (p instanceof Or && canBranch) {
         let kS = selectNewChannels(used, cn, p.children.length);
         ret.push(new en.Fork(kS, idx));
      }
      // to-star, elements might not be adjacent.
      {
         let seen = new Set<pt.Channel>();
         for (let jdx = idx + 1; jdx < self.children.length; jdx += 1) {
            let [rp, rcn] = self.elements[jdx];
            let cn0 = cn.toStar(rcn, seen);
            if (!cn0)
               continue;
            if (pt.isStarLike(p)) {
               let ins = new en.PushLR(cn0, idx, "left");
               if (ins.transform(self))
                  ret.push(ins)
            }
            if (pt.isStarLike(rp)) {
               let ins = new en.PushLR(cn0, idx, "right");
               if (ins.transform(self))
                  ret.push(ins)
            }
            seen.add(rcn);
         }
      }

      if (p.plength == 1) {
         // can be swapped. 
         for (let jdx = idx + 1; jdx < self.elements.length; jdx += 1) {
            let [np, ncn] = self.elements[jdx];
            if (np.plength != 1)
               continue;
            let use: pt.Channel;
            if (cn.isUnder(ncn))
               use = cn;
            else if (ncn.isUnder(cn))
               use = ncn;
            else continue;
            ret.push(new en.Swap(use, idx, jdx)); // self.toLocal(idx, use), self.toLocal(jdx, use)));
         }
      }
      {
         // we need. 
         let dir: "front" | "back";
         {
            if (self.elements.slice(0, idx).every(e => !e[1].isRelated(cn)))
               dir = "front";
            else if (self.elements.slice(idx + 1, self.elements.length).every(e => !e[1].isRelated(cn)))
               dir = "back";
         }
         if (dir) {
            let loop = cn;
            while (loop) {
               if (loop instanceof pt.LoopChannel) {
                  let lift = new en.Lift(cn, loop, dir);
                  if (lift.transform(self) != null)
                     ret.push(lift);
                  break;
               } else {
                  loop = loop.parent;
                  continue;
               }
            }
         }
      }
      if (!cn.peers().isEmpty() && !cn.isLoop) {
         for (let jdx = idx; jdx < self.elements.length; jdx += 1) {
            if (self.elements[jdx][1] != cn)
               break;
            let q = self.slice(idx, jdx + 1);
            //let idxS = [cn].concat(...cn.peers()).map(k => self.toLocal(idx, k));
            if (q.elements.length == 1 && q.elements[0][0] instanceof pt.Star) { }
            else if (q.elements.length == 1 && q.elements[0][0] instanceof pt.Opt) { }
            else ret.push(new en.MakeOpt(cn, idx, q.elements.length));
         }
      }
      for (let jdx = idx; jdx < self.elements.length; jdx += 1) {
         let [use, len] = self.lowestChannel(idx, jdx);
         if (len < 0)
            continue;
         let r0 = new pt.Root(...self.elements.slice(idx, jdx + 1)).filter(use);
         (r0.elements.length == len).assert();
         // now...
         let key = r0.asSeq().hashInput(false);
         let rev = r0.asSeq().hashInput(true);
         if (db.dict.has(key)) {
            for (let code of db.dict.get(key)) {
               if (!code.input || !code.output)
                  continue;
               let txtS = code.input.unifyTop(r0.asSeq(), pt.RootUnify);
               for (let txt of txtS) {
                  let output = code.output.replace(txt);
                  if (!output)
                     continue;
                  let op = new en.Call(code, use, idx, txt, false);
                  if (op.transform(self, [], false))
                     ret.push(op);
               }
            }
         }
         if (db.dict.has(rev)) {
            for (let code of db.dict.get(rev)) {
               let txtS = code.input.reverse().unifyTop(r0.asSeq(), pt.RootUnify);
               if (txtS.length == 0)
                  continue;
               for (let txt of txtS) {
                  let op = new en.Call(code, use, idx, txt, true);
                  if (op.transform(self, [], false))
                     ret.push(op);
               }
            }
         }



      }
      if (self.elements.every(([a, b]) => b == cn) && !(cn instanceof pt.LoopChannel)) {
         let [loop] = selectNewChannels(used, cn, "loop", self.asSeq());
         ret.push(new en.Loop(loop as pt.LoopChannel))
      }
      {
         let endPoints: Channel[] = null;
         //let ret0 : en.Operation[] = [];
         for (let p = cn; p != pt.RootChannel; p = p.parent) {
            if (p instanceof LoopChannel && p != cn) {
               if (!endPoints)
                  endPoints = self.endPoints;
               let core = self.includeOnlyUnder(p);
               for (let b of endPoints) {
                  if (!b.isUnder(p))
                     continue;
                  let seq = core.filter(b).asSeq();
                  for (let i = 0; i < oprs.length; i += 1) {
                     let [a, b0] = oprs.last(i);
                     if (a instanceof en.Loop && a.toLoop == p) {
                        let b1 = b0.asSeq();
                        let txt = pt.RootUnify;
                        b1.visit(p => {
                           if (pt.isTermLike(p))
                              txt = txt.bindTerm(p.term, p.term);
                           return true;
                        })
                        let txtS = b1.unify(seq, txt, b0);
                        if (txtS.length == 1) {
                           let b2 = b1.replace(txtS[0]);
                           if (seq.equals(b2)) {
                              ret.push(new en.Unloop(b, p));
                              break;
                           }
                        }
                     } else if (a instanceof en.Unloop && a.loop == p)
                        break;
                  }
               }
            }
         }
         //if (!ret0.isEmpty())
         //   return ret0;
      }
      if (cn == pt.RootChannel && self.elements.every(([a, b]) => b == pt.RootChannel) && oprs.length > 1) {
         ret.push(en.Return.Instance);

      }
      {
         let exist = new Set<string>();
         ret = ret.filter(e => {
            let r = e.transform(self, oprs, false).adbg;
            if (exist.has(r))
               return false;
            exist.add(r);
            return true;
         })


      }


      return ret;
   }
   Pattern.prototype.options = function () {
      return [];
   }
}

namespace pt {
   export interface Pattern {
      buildOptions(parent: Pattern, root: Root): Pattern[];
   }
   export interface Root {
      buildOptions(idxS: number[]): Seq[];
   }
   Root.prototype.buildOptions = function (idxAt) {
      let self = this as Root;
      let ret: Seq[] = [];
      let exist = self.asSeq();
      if (idxAt.length > 1) {
         let at = self.access(idxAt);
         let parent = self.access(idxAt, idxAt.length - 1);
         let idxParent = idxAt.copy();
         idxParent.pop();
         let idx = idxAt.last();
         (parent.children[idx].equals(at)).assert();
         let opts = at.buildOptions(parent, self);
         for (let opt of opts) {
            let updated = self.update(idxAt, opt);
            if (updated)
               ret.push(updated.asSeq());
         }
         if (parent instanceof Seq || parent instanceof Or) {
            let cS = parent.children.copy();
            cS.splice(idx, 1);
            let tS: string[];
            if (parent instanceof Or) {
               tS = parent.tags.copy();
               tS.splice(idx, 1);
            }
            ret.push(self.update(idxParent,
               cS.length == 1 ? cS[0] :
                  parent instanceof Seq ? new Seq(...cS) :
                     new Or(cS, tS)).asSeq());
         }
         if (parent instanceof Seq && (at instanceof Opt || at instanceof Star)) {
            for (let i = idx + 1; i < parent.children.length; i += 1) {
               let cS = [at.child].concat(parent.children.slice(idx + 1, i + 1));
               let seq = new Seq(...cS);
               //if (idx == 0 && i == parent.children.length - 1) { }
               //else 
               {
                  if (at instanceof Opt)
                     ret.push(self.update(idxParent, seq.opt()).asSeq());
                  else
                     ret.push(self.update(idxParent, seq.star()).asSeq());
               }
            }
         }
      } else ret.push(new Seq(...exist.children.concat(smallA)));
      return ret.filter(p => p != null);
   }


   Pattern.prototype.buildOptions = function (parent, root) {
      let self = this as Term;
      let ret: Pattern[] = [];
      ret.push(self.or(null, smallA));
      ret.push(self.seq(smallA));
      ret.push(self.opt());
      ret.push(self.star());
      return ret;
   }
   OrSeq.prototype.buildOptions = function (parent, root) {
      let self = this as OrSeq;
      let ret = Pattern.prototype.buildOptions.call(self, parent, root) as Pattern[];
      return ret;
   }

   Term.prototype.buildOptions = function (parent, root) {
      let self = this as Term;
      let ret = Pattern.prototype.buildOptions.call(self, parent, root) as Pattern[];
      for (let t of [pt.smallA, pt.smallB, pt.smallC, pt.smallD, pt.smallE, pt.smallF])
         if (t != self)
            ret.push(t);

      return ret;
   }
   Single.prototype.buildOptions = function (parent, root) {
      let self = this as Single;
      let ret = Pattern.prototype.buildOptions.call(self, parent, root) as Pattern[];
      ret.push(this.child);
      return ret;
   }
   /*
   Ordered.prototype.buildOptions = function (parent, root) {
      let self = this as Ordered;
      let ret = Single.prototype.buildOptions.call(self, parent, root) as Pattern[];
      ret.push(new Ordered(self.child, !self.ascending));
      return ret;
   }
   */
}