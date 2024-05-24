// components/camera-face/index.js

import { getAuthorize, setAuthorize, throttle, checkVersion } from './utils'

// 提示信息
const tips = {
  ready: '请确保光线充足,正面镜头',
  recording: '人脸录制中..',
  complete: '已录制完成',
  error: '录制失败'
}

Component({

  // 组件的属性列表
  properties: {
    // 人脸整体可信度 [0-1], 参考wx.faceDetect文档的res.confArray.global
    // 当超过这个可信度且正脸时开始录制人脸, 反之停止录制
    faceCredibility: {
      type: Number,
      value: 0.5
    },
    // 人脸偏移角度正脸数值参考wx.faceDetect文档的res.angleArray
    // 越接近0越正脸，包括p仰俯角(pitch点头）, y偏航角（yaw摇头), r翻滚角（roll左右倾）
    faceAngle: {
      type: Object,
      value: { p: 0.5, y: 0.5, r: 0.5 }
    },
    // 录制视频时长,不能超过30s
    duration: {
      type: Number,
      value: 60000
    },
    // 是否压缩视频
    compressed: {
      type: Boolean,
      value: false
    },
    // 前置或者后置 front,back
    devicePosition: {
      type: String,
      value: 'front'
    },
    // 指定期望的相机帧数据尺寸 small,medium,large
    frameSize: {
      type: String,
      value: 'medium'
    },
    // 分辨率 low,medium,high
    resolution: {
      type: String,
      value: 'medium'
    },
    // 闪光灯 auto,on,off,torch
    flash: {
      type: String,
      value: 'off'
    },
    // 检测视频帧的节流时间，默认500毫秒执行一次
    throttleFrequency: {
      type: Number,
      value: 500
    }
  },

  // 组件页面的生命周期
  pageLifetimes: {
    // 页面被隐藏
    hide: function() {
      this.stop()
    },

    show: function() {
      const info = wx.getSystemInfoSync()
      const pixelRatio = info.pixelRatio
      const rpxHeight = info.windowHeight * 750 / info.windowWidth 
      this.setData({cameraHeight : (rpxHeight - 400)})
      console.log("width: " + info.windowWidth + "  height:" + info.windowHeight + " pixelRatio:" + pixelRatio + "  rpxHeight=" + rpxHeight)
    }
  },
  detached: function() {
    // 在组件实例被从页面节点树移除时执行
    this.stop()
  },

  // 组件的初始数据
  data: {
    isReading: false, // 是否在准备中
    isRecoding: false, // 是否正在录制中
    isStopRecoding: false, // 是否正在停止录制中
    bottomTips: '', // 底部提示文字
    cameraHeight:505
  },

  vksession : null ,
  /**
   * 组件的方法列表
   */
  methods: {

    // 开启相机ctx
    async start() {
      const result = await this.initAuthorize();
      if (!result) return false;
      if (!this.ctx) this.ctx = wx.createCameraContext();
      this.vksession = wx.createVKSession({
        track: {
          face: { mode: 1 } // mode: 1 - 使用摄像头；2 - 手动传入图像
        }
      })
      return true;
    },

    // 准备录制
    async readyRecord() {
      if (this.data.isReading) return
      this.setData({ isReading: true , isRecoding:false , isCompleteRecoding: false, isStopRecoding: false})
      wx.showLoading({ title: '加载中..', mask: true })
      // 检测版本号
      const canUse = checkVersion('2.18.0', () => {
        this.triggerEvent('cannotUse')
      })
      if (!canUse) {
        wx.hideLoading()
        this.setData({ isReading: false })
        return
      }

      // 启用相机
      try {
        const result = await this.start()
        if (!result || !this.ctx) throw new Error()
      } catch (e) {
        wx.hideLoading()
        this.setData({ isReading: false })
        return
      }
      console.log('准备录制')
      this.setData({ bottomTips: tips.ready })

      // 摄像头实时检测模式下，监测到人脸时，updateAnchors 事件会连续触发 （每帧触发一次）
      this.vksession.on('updateAnchors', anchors => {
        // console.log('updateAnchors : ' + JSON.stringify(anchors))
        anchors.forEach(anchor => {
          console.log('anchor.points', anchor.points)
          console.log('anchor.origin', anchor.origin)
          console.log('anchor.size', anchor.size)
          console.log('anchor.angle', anchor.angle)
        })
        this.processVKSessionFaceData()
      })
      
      // 当人脸从相机中离开时，会触发 removeAnchors 事件
      this.vksession.on('removeAnchors', () => {
        console.log('removeAnchors')
        this.cancel()
      })

      console.log('vksession starting....')
      // 需要调用一次 start 以启动
      this.vksession.start(errno => {
        console.log('vksession started errno=' + errno)
        wx.hideLoading()
        if (errno) {
          // 如果失败，将返回 errno
        } else {
          // 否则，返回null，表示成功
          //限制调用帧率
          let fps = 10
          let fpsInterval = 1000 / fps
          let last = Date.now()
          var cameraWidth, cameraHeight;
          var selectorQuery = wx.createSelectorQuery();
          
          selectorQuery.select('#myCamera').fields({
            width: true,
            height: true
          }).exec(function(rect){
            // rect.id      : 返回节点的ID
            // rect.dataset : 返回节点的dataset
            // rect.left    : 节点的左边界坐标
            // rect.right   : 节点的右边界坐标
            // rect.top     : 节点的上边界坐标
            // rect.bottom  : 节点的下边界坐标
            // rect.width   : 节点的宽度
            // rect.height  : 节点的高度
            cameraWidth = rect.width;
            cameraHeight = rect.height;
          });

        console.log('camera : width=' + cameraWidth + )
        let fn = throttle((frame) => {
          let now = Date.now() 
          const mill = now - last
          console.log('onFrame .....')
          // 经过了足够的时间
          if (mill > fpsInterval) {
              last = now - (mill % fpsInterval); //校正当前时间
              console.log('onFrame .....')
              this.vksession.getVKFrame(cameraWidth, cameraHeight)
          }
        },this.properties.throttleFrequency)
        const listener = this.listener = this.ctx.onCameraFrame((frame) => fn(frame));
        listener.start();
          // 逐帧渲染
          // const onFrame = timestamp => {
          //     let now = Date.now() 
          //     const mill = now - last
          //     console.log('onFrame .....')
          //     // 经过了足够的时间
          //     if (mill > fpsInterval) {
          //         last = now - (mill % fpsInterval); //校正当前时间
          //         console.log('onFrame .....')
          //         this.vksession.getVKFrame(cameraWidth, cameraHeight)
          //     }
          //     this.vksession.requestAnimationFrame(onFrame)
          // }
          // console.log('start requestAnimationFrame')
          // this.vksession.requestAnimationFrame(onFrame)          
        }
      })

      // 视频帧回调节流函数
      // let fn = throttle((frame) => {
      //   // 人脸识别
      //   wx.faceDetect({
      //     frameBuffer: frame.data,
      //     width: frame.width,
      //     height: frame.height,
      //     enableConf: true,
      //     enableAngle: true,
      //     success: (res) => this.processFaceData(res),
      //     fail: (err) => this.cancel()
      //   })
      // }, this.properties.throttleFrequency);

      // // 初始化人脸识别
      // wx.initFaceDetect({
      //   success: () => {
      //     const listener = this.listener = this.ctx.onCameraFrame((frame) => fn(frame));
      //     listener.start();
      //   },
      //   fail: (err) => {
      //     console.log('初始人脸识别失败', err)
      //     this.setData({ bottomTips: '' })
      //     wx.showToast({ title: '初始人脸识别失败', icon: 'none' })
      //   },
      //   complete: () => {
      //     wx.hideLoading()
      //     this.setData({ isReading: false })
      //   }
      // })
    },

    // 处理人脸识别数据
    processVKSessionFaceData() {
      console.log('人脸可信,且是正脸');
      if (this.data.isRecoding || this.data.isCompleteRecoding) return
      this.setData({ isRecoding: true });
      this.startRecord(); // 开始录制
      
      // const { global } = res.confArray;

      //   const g = this.properties.faceCredibility;
      //   const { pitch, yaw, roll } = res.angleArray;
      //   const { p, y, r } = this.properties.faceAngle;
      //   console.log('res.confArray.global:', global)
      //   console.log('res.angleArray:',  pitch, yaw, roll)
      //   const isGlobal = global >= g;
      //   const isPitch = Math.abs(pitch) <= p;
      //   const isYaw = Math.abs(yaw) <= y;
      //   const isRoll = Math.abs(roll) <= r;
      //   if( isGlobal && isPitch && isYaw && isRoll ){
      //     console.log('人脸可信,且是正脸');
      //     if (this.data.isRecoding || this.data.isCompleteRecoding) return
      //     this.setData({ isRecoding: true });
      //     this.startRecord(); // 开始录制
      //   }else {
      //     console.log('人脸不可信,或者不是正脸');
      //     this.cancel()
      //   }
      // }else {
      //   console.log('获取人脸识别数据失败', res);
      //   this.cancel()
      // }
    },

    // 处理人脸识别数据
    processFaceData(res) {
      if(res.confArray && res.angleArray) {
        const { global } = res.confArray;
        const g = this.properties.faceCredibility;
        const { pitch, yaw, roll } = res.angleArray;
        const { p, y, r } = this.properties.faceAngle;
        console.log('res.confArray.global:', global)
        console.log('res.angleArray:',  pitch, yaw, roll)
        const isGlobal = global >= g;
        const isPitch = Math.abs(pitch) <= p;
        const isYaw = Math.abs(yaw) <= y;
        const isRoll = Math.abs(roll) <= r;
        if( isGlobal && isPitch && isYaw && isRoll ){
          console.log('人脸可信,且是正脸');
          if (this.data.isRecoding || this.data.isCompleteRecoding) return
          this.setData({ isRecoding: true });
          this.startRecord(); // 开始录制
        }else {
          console.log('人脸不可信,或者不是正脸');
          this.cancel()
        }
      }else {
        console.log('获取人脸识别数据失败', res);
        this.cancel()
      }
    },

    // 开始录制
    startRecord() {
      console.log('开始录制')
      this.setData({ isCompleteRecoding: false })
      this.ctx.startRecord({
        timeout: 200 ,    // 最长测试时间200S以内
        success: (res) => {
          this.setRecordingTips();
          this.timer = setTimeout(() => {
            this.completeRecord()
          }, this.properties.duration + 500) // 额外增加500ms
        },
        timeoutCallback: (res) => {
          // 超过30s或页面 onHide 时会结束录像
          this.completeRecord()
        },
        fail: () => this.stop()
      })
    },
    // 设置录制中的提示文字和倒计时
    setRecordingTips() {
      let second = (this.properties.duration / 1000);
      if (this.interval) clearInterval(this.interval);
      this.interval = setInterval(() => {
        console.log('xxxxxx', second);
        this.setData({
          bottomTips: tips.recording + second-- + 's'
        })
        if (second <= 0) clearInterval(this.interval);
      }, 1000)
    },

    // 完成录制
    completeRecord() {
      console.log('完成录制');
      this.setData({ isCompleteRecoding: true })
      wx.stopFaceDetect();

      this.ctx.stopRecord({
        compressed: this.properties.compressed,
        success: (res) => {
          this.setData({ bottomTips: tips.complete })
          setTimeout( () => {
            this.setData({ bottomTips: '' })
          } , 5000)
        },
        fail: () => this.stop(),
        complete: (res) => {
          this.listener.stop();
          clearInterval(this.interval);
          // this.setData({ isCompleteRecoding: false })
          // 向外触发完成录制的事件
          console.log('sendEvent: complete')
          this.triggerEvent('complete', res.tempVideoPath)
        }
      })
    },
    // 人脸移出等取消录制
    cancel() {
      console.log('取消录制');
      // 如果不在录制中或者正在录制完成中就不能取消
      if (!this.data.isRecoding || this.data.isCompleteRecoding) return
      clearTimeout(this.timer);
      clearInterval(this.interval);
      this.ctx.stopRecord({
        complete: () => {
          console.log('取消录制成功');
          this.setData({ bottomTips: tips.ready, isRecoding: false });
        }
      });
    },
    // 用户切入后台等停止使用摄像头
    stop() {
      console.log('停止录制');
      clearTimeout(this.timer);
      clearInterval(this.interval);
      if(this.listener) this.listener.stop();
      if (this.ctx && !this.data.isCompleteRecoding) this.ctx.stopRecord()
      wx.stopFaceDetect();
      setTimeout(() => {
        this.setData({ bottomTips: '', isRecoding: false })
      }, 500)
    },
    // 用户不允许使用摄像头
    error(e) {
      // const cameraName = 'scope.camera';
      // this.triggerEvent('noAuth', cameraName)
    },

    // 初始相机和录音权限
    async initAuthorize() {
      const cameraName = 'scope.camera';
      const recordName = 'scope.record';
      const scopeCamera = await getAuthorize(cameraName);
      // 未授权相机
      if (!scopeCamera) {
        // 用户拒绝授权相机
        if (!(await setAuthorize(cameraName))) this.openSetting();
        return false;
      }
      const scopeRecord = await getAuthorize(recordName);
      if (!scopeRecord) {
        // 用户拒绝授权录音
        if (!(await setAuthorize(recordName))) {
          this.openSetting();
          return false;
        }
      }
      return true;
    },

    // 打开设置授权
    openSetting() {
      wx.showModal({
        title: '开启摄像头和录音权限',
        showCancel: true,
        content: '是否打开？',
        success: (res) => {
          this.triggerEvent('noAuth', '打开设置授权')
          if (res.confirm) {
            wx.openSetting();
          }
        }
      });
    }
  }
})
