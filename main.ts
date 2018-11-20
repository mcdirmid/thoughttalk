
namespace main {

   class Local extends rn.RootHolder {
      readonly child0: ptrn.Root;
      get children() { return super.children.concat(this.child0); }
      constructor(readonly parent: ui2.Top, top: pt.Root) {
         super();
         this.child0 = top.makeRender(this);
         //  new ptrn.TopImpl(this, new pt.Path(top, []) as pt.PathT<pt.Top>);
         this.child0.position = (100).vec(100);
      }
      renderLocal(g: Render2D) {
         let sz = this.child0.fixedSz(g);
         super.renderLocal(g);
      }
      maxPopupHeight(): number { throw new Error(); }
   }
   class Main extends ui2.Elem {
      readonly code: ptrn.Code;
      readonly timeline: ptrn.Timeline;
      readonly exec: ptrn.ExecRoot;
      get children() { return this.timeline ? [this.code, this.timeline, this.exec] : [this.code]; }
      constructor(readonly parent: ui2.Top, code: en.Code, txt: ex.Context, rev: boolean) {
         super();
         this.code = new ptrn.Code(parent, code);
         this.code.position = (100).vec(100);
         if (txt) {
            this.exec = new ptrn.ExecRoot(this, txt);
            this.timeline = new ptrn.Timeline(this, this.code, this.exec, txt, rev);
         }
         //this.timeline.code = this.code;
         //this.timeline.exec = this.exec;
      }

      renderLocal(g: Render2D) {
         let sz = this.code.fixedSz(g);
         if (this.timeline) {
            this.timeline.position = (this.code.position.x + sz.x + 5).vec(this.code.position.y);
            sz = this.timeline.fixedSz(g);
            this.exec.position = (this.timeline.position.x + sz.x + 5).vec(this.code.position.y);
            this.exec.fixedSz(g);
         }
         super.renderLocal(g);
      }
   }
   class Shell extends ui2.Elem {
      readonly inner: ptrn.Shell;
      get children() { return [this.inner]; }
      constructor(readonly parent: ui2.Top) {
         super();
         this.inner = new ptrn.Shell(this);
         this.inner.position = (100).vec(100);
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         this.size = this.parent.size;
         this.inner.fixedSz(g);
      }
   }



   function f() {
      let top = ui2.Top.useWindow();
      top.g.font = rn.font;
      top.g.fillStyle = rn.fontColor;
      //top.child = new Root(top);
      let a = new pt.Term("a");
      let b = new pt.Term("b");

      let t0 = a.or("t", b).star();
      let t1 = a.star().seq(b.star());
      let t2 = a.star().seq(
         b.seq(t0, a).opt(),
         b.star(),
      )
      let top0 = new pt.Root([t2, pt.RootChannel])


      top.child = new Local(top, top0);

      console.debug(t0.adbg + " " + t1.adbg + " " + t2.adbg);


      top.renderAll();
   }
   function g() {
      //top.child = new Root(top);
      let a = new pt.Term("a");
      let b = new pt.Term("b");
      let abs = a.or("t", b).star();
      let [red, blue] = pt.RootChannel.branch(["red", RGB.red], ["blue", RGB.blue]);
      // a*b => ba*
      let q1 = pt.Root.make(a, a.star(), b).setChannel(0, 2, red);
      let p = q1;
      let cr = p.filter(red);
      let cb = p.filter(blue);



      let q = p.splits(red, [[0, 1], [2, 1]]);
      q = q.swap(0, 2);

      //console.debug("count: " + p.access().elementCount());
      //console.debug("count: " + p.access().elementAt(1)[0] + " " + p.access().elementAt(1)[1]);
      console.debug("red: " + cr);
      console.debug("blue: " + cb);



      let top = ui2.Top.useWindow();
      top.g.font = rn.font;
      top.g.fillStyle = rn.fontColor;
      top.child = new Local(top, q);
      top.renderAll();
   }
   function h() {
      let a = new pt.Term("a");
      let b = new pt.Term("b");
      let c = new pt.Term("c");
      let d = new pt.Term("d");
      let e = new pt.Term("e");
      let f = new pt.Term("f");
      let slide = new en.Code("_slide", c.seq(d.star()));
      if (true) {
         slide.output = d.star().seq(c);
         let [red, blue] = pt.RootChannel.branch(["red", RGB.red], ["blue", RGB.blue]);
         slide.output = slide.input.reverse();
         slide.push(new en.PopLR([red, blue], 1, "right"));
         slide.push(new en.Swap(red, 0, 2));
         slide.push(new en.PushLR(red, 0, "right"));
         slide.push(new en.EmptyStar(red, 0));
         slide.push(en.Return.Instance);
         slide.setOutput();
      }

      let sift = new en.Code("_sift", (e.or("sift", f).star()).seq());
      {
         sift.output = e.star().seq(f.seq(e.or("siftout", f).star()).opt());
         let lime = RGB.green.lerp(RGB.lime, .5).lerp(RGB.black, .25);
         let loop = new pt.LoopChannel(pt.RootChannel, lime, "lime");
         let [red, blue] = loop.branch(["red", RGB.red.lerp(RGB.black, .125)], ["blue", RGB.dodgerblue]);
         let [purple, orange] = red.branch(["magenta", RGB.magenta], ["orange", RGB.orange]);
         sift.push(new en.Loop(loop));
         sift.push(new en.PopLR([red, blue], 0, "left"));
         sift.push(new en.Fork([purple, orange], 0));
         // a is purple
         sift.push(new en.Lift(purple, loop, "front"));
         sift.push(new en.Unloop(purple, loop));
         sift.push(new en.MakeOpt(red, 1, 2));
         sift.push(en.Return.Instance);
         sift.setOutput();
      }
      let siftback = new en.Code("_siftback", (c.or("siftback", d).star()).seq(d).opt().seq());
      {
         siftback.output = d.star().seq(c.seq(c.or("siftbackout", d).star(), d).opt());
         //let lime = RGB.green.lerp(RGB.lime, .5).lerp(RGB.black, .25);
         //let loop = new pt.LoopChannel(pt.RootChannel, lime, "lime", partition.input);
         let [red, blue] = pt.RootChannel.branch(["red", RGB.red.lerp(RGB.black, .125)], ["blue", RGB.dodgerblue]);
         let [purple, orange] = red.branch(["magenta", RGB.magenta], ["orange", RGB.orange]);
         siftback.push(new en.Poke([red, blue], 0));
         siftback.push(new en.Call(sift, red, 0, [[e, d], [f, c]], false));
         siftback.push(new en.Poke([purple, orange], 1));
         siftback.push(new en.PushLR(orange, 0, "left"));
         // d* c (c|d)* d
         siftback.push(new en.MakeOpt(purple, 1, 3));
         // d* (c (c|d)* d)?
         siftback.push(new en.EmptyStar(red, 0));
         siftback.push(new en.EmptyOpt(red, 1));
         siftback.push(en.Return.Instance);
         siftback.setOutput();

      }
      let hoarePartition = new en.Code("_hoare-partition", (a.or("hoarse", b).star()).seq());
      {
         hoarePartition.output = a.star().seq(b.star());
         let lime = RGB.green.lerp(RGB.lime, .5).lerp(RGB.black, .25);
         let loop = new pt.LoopChannel(pt.RootChannel, lime, "lime");
         let [red, blue] = loop.branch(["red", RGB.red.lerp(RGB.black, .125)], ["blue", RGB.dodgerblue]);
         let [purple, orange] = red.branch(["magenta", RGB.magenta], ["orange", RGB.orange]);

         hoarePartition.push(new en.Loop(loop));
         hoarePartition.push(new en.Call(sift, loop, 0, [[e, a], [f, b]], false));
         hoarePartition.push(new en.Call(siftback, loop, 1, [[d, b], [c, a]], true));
         hoarePartition.push(new en.Lift(loop, loop, "front"));
         hoarePartition.push(new en.Lift(loop, loop, "back"));
         hoarePartition.push(new en.Poke([red, blue], 1));
         hoarePartition.push(new en.Swap(red, 1, 3));
         hoarePartition.push(new en.PushLR(red, 0, "left"));
         hoarePartition.push(new en.PushLR(red, 2, "right"));
         hoarePartition.push(new en.Unloop(red, loop));
         hoarePartition.push(en.Return.Instance);
         hoarePartition.setOutput();
      }
      let lomutoPartition = new en.Code("_lomuto-partition", (a.or("lomuto", b).star()).seq());
      {
         lomutoPartition.output = a.star().seq(b.star());
         let lime = RGB.green.lerp(RGB.lime, .5).lerp(RGB.black, .25);
         let loop = new pt.LoopChannel(pt.RootChannel, lime, "lime");
         let [red, blue] = loop.branch(["red", RGB.red.lerp(RGB.black, .125)], ["blue", RGB.dodgerblue]);
         let [purple, orange] = red.branch(["magenta", RGB.magenta], ["orange", RGB.orange]);
         lomutoPartition.push(new en.Loop(loop));
         lomutoPartition.push(new en.PopLR([red, blue], 0, "left"));
         lomutoPartition.push(new en.Fork([purple, orange], 0));
         lomutoPartition.push(new en.Lift(orange, loop, "front"));
         lomutoPartition.push(new en.Call(slide, purple, 0, [[c, a], [d, b]], true));
         lomutoPartition.push(new en.Lift(purple, loop, "front"));
         lomutoPartition.push(new en.Unloop(red, loop));
         lomutoPartition.push(en.Return.Instance);
         lomutoPartition.setOutput();
      }
      let dutchPartition = new en.Code("_dutch-partition", (a.or("lomuto", b, c).star()).seq());
      {
         let lime = RGB.green.lerp(RGB.lime, .5).lerp(RGB.black, .25);
         let loop = new pt.LoopChannel(pt.RootChannel, lime, "lime");
         let [red, blue] =
            loop.branch(["red", RGB.red.lerp(RGB.black, .125)], ["blue", RGB.dodgerblue]);
         let [purple, orange, grey] = red.branch(["magenta", RGB.magenta], ["orange", RGB.orange], ["gray", RGB.grey]);
         dutchPartition.push(new en.Loop(loop));
         dutchPartition.push(new en.PopLR([red, blue], 0, "left"));
         dutchPartition.push(new en.Fork([purple, orange, grey], 0));
         dutchPartition.push(new en.Lift(grey, loop, "front"));
         dutchPartition.push(new en.Call(slide, orange, 0, [[c, b], [d, c]], true));
         dutchPartition.push(new en.Lift(orange, loop, "front"));
         dutchPartition.push(new en.Call(slide, purple, 1, [[c, a], [d, c]], true));
         dutchPartition.push(new en.Call(slide, purple, 0, [[c, a], [d, b]], true));
         dutchPartition.push(new en.Lift(purple, loop, "front"));
         dutchPartition.push(new en.Unloop(red, loop));
         dutchPartition.push(en.Return.Instance);
         dutchPartition.setOutput();
      }
      let reverse = new en.Code("_reverse", new ss.Ordered(a, 0, 1, true).seq());
      {
         let lime = RGB.green.lerp(RGB.lime, .5).lerp(RGB.black, .25);
         let loop = new pt.LoopChannel(pt.RootChannel, lime, "lime");
         let [red, blue] = loop.branch(["red", RGB.red.lerp(RGB.black, .125)], ["blue", RGB.dodgerblue]);
         let [purple, orange] = red.branch(["magenta", RGB.magenta], ["orange", RGB.orange]);

         reverse.output = new ss.Ordered(a, 0, 1, false).seq();
         reverse.push(new en.Loop(loop));
         reverse.push(new en.PopLR([red, blue], 0, "left"));
         reverse.push(new en.PopLR([purple, orange], 1, "right"));
         reverse.push(new en.Swap(purple, 0, 2));
         reverse.push(new en.Lift(purple, loop, "front"));
         reverse.push(new en.Lift(red, loop, "back"));
         reverse.push(new en.Unloop(purple, loop));
         reverse.push(new en.PushLR(pt.RootChannel, 0, "right"));
         reverse.push(en.Return.Instance);
         reverse.setOutput();
      }
      let quicksort = new en.Code("_quicksort", a.star().seq());
      {
         //quicksort.output = new pt.Ordered(new pt.Subscript(a, 0, "none"), true).seq();
         quicksort.output = new ss.Ordered(a, 0, 1, true).seq();
         let [red, blue] = pt.RootChannel.branch(["red", RGB.red.lerp(RGB.black, .125)], ["blue", RGB.dodgerblue]);
         quicksort.push(new en.PopLR([red, blue], 0, "left"));
         quicksort.push(new ss.Pivot(red, 0));
         quicksort.push(new ss.Divide(red, [0, 1, 0], 0));
         {
            let ax = quicksort.operations.last()[1].elements[1][0].seq();
            let bx = hoarePartition.input;
            let txtS = bx.unify(ax, pt.RootUnify, quicksort.operations.last()[1]);
            quicksort.push(new en.Call(hoarePartition, red, 1, txtS[1], false));
         }
         {
            let ax = new pt.Seq(...quicksort.operations.last()[1].elements.slice(0, 2).map(e => e[0]));
            let bx = slide.input;
            let txtS = bx.unify(ax, pt.RootUnify, quicksort.operations.last()[1]);
            quicksort.push(new en.Call(slide, red, 0, txtS[0], false));
         }
         {
            let ax = quicksort.operations.last()[1].elements[0][0].seq();
            let bx = quicksort.input;
            let txtS = bx.unify(ax, pt.RootUnify, quicksort.operations.last()[1]);
            quicksort.push(new en.Call(quicksort, red, 0, txtS[0], false));
         }
         {
            let ax = quicksort.operations.last()[1].elements[2][0].seq();
            let bx = quicksort.input;
            let txtS = bx.unify(ax, pt.RootUnify, quicksort.operations.last()[1]);
            quicksort.push(new en.Call(quicksort, red, 2, txtS[0], false));
         }
         quicksort.push(new en.PushLR(red, 0, "left"));
         quicksort.push(new en.PushLR(red, 0, "left"));
         quicksort.push(new en.EmptyStar(red, 0));
         quicksort.push(en.Return.Instance);
         quicksort.setOutput();

      }
      let top = ui2.Top.useWindow();
      top.g.font = rn.font;
      top.g.fillStyle = rn.fontColor;
      if (true) {
         top.child = new Shell(top);
         //(top.child as Shell).inner.setCode(quicksort);
         (top.child as Shell).inner.backup.push(
            slide,
            sift,
            siftback,
            lomutoPartition,
            hoarePartition,
            reverse,
            quicksort,
            dutchPartition,
         );
         //(top.child as Shell).inner.loaded.push(slide);
         //(top.child as Shell).inner.userOptions.add(slide);
      }
      top.renderAll();


   }


   console.debug("Hello world");
   h();
   console.debug("again");
}
