
const serverUrl = 'https://xlbusiness.qdscitech.cn'
const ossUrl = 'https://upload-video-1.oss-cn-beijing.aliyuncs.com'
const programCode = 'b1139969aa2e4f86a74bfce080e3cd28'
var userToken = ''

export const checkUserToken = () => {
  console.log('checkUserToken: ' + userToken)
  if(userToken && userToken != '') {
    return true
  }

  return false 
}

export const getUserToken = (userId, onSuccess, onFailed) => {
  console.log('getUserToken : code=' + userId)
  wx.request({
    url : serverUrl + '/v1/app/getUserToken' ,
    method : 'POST',
    data : {
      "programCode" : programCode,
      "code" : userId
    },
    dataType:'json',
    success : (res) => {
      console.log('getUserToken res success: ' + JSON.stringify(res))
      var result = res.data 
      if(result.code != 1) {
        onFailed(res) 
        return 
      }
      var token = result.data.token 
      if(!token || token == '') {
        onFailed(res) 
        return 
      }

      userToken = token  

      onSuccess(res) 
    },
    failed : onFailed
  })
}

export const getUserInfo = (onSuccess, onFailed) => {
  
  wx.request({
    url : serverUrl + '/v1/app/getUserinfo' ,
    method : 'GET',
    dataType:'json',  
    header: {
      'Cookie' : 'token=' + userToken
    },
    success : onSuccess,
    failed : onFailed
  })
}

export const updateUserInfo = (userId, gender, name, age, onSuccess, onFailed) => {

  wx.request({
    url : serverUrl + "/v1/app/updateinfo" ,
    method : 'POST',
    dataType:'json',
    data : {
      "gender" : gender,
      "name" :  name, 
      "age" : age ,
      "code" : userId
    },
    header: {
      'Content-Type' : 'application/json',
      'Cookie' : 'token=' + userToken
    },
    success : onSuccess,
    failed : onFailed
  })
}

export const getAliKey = (onSuccess, onFailed) => {
  wx.request({
    url : serverUrl + "/v1/app/getAliKey" ,
    method : 'GET',
    header: {
      'Cookie' : 'token=' + userToken
    },
    dataType : 'json',
    success : onSuccess,
    failed : onFailed
  })
}

export const uploadVideoFile = (sts, file, onSuccess, onFailed) => {
  console.log('uploadFile file=' + file + '  sts=' + JSON.stringify(sts))
  wx.uploadFile({
    filePath: file,
    name: 'file',
    url: ossUrl,
    formData : {
      "key" : sts.video_id + ".mp4",
      "OSSAccessKeyId" : sts.AccessKeyId,
      "policy" : sts.policyBase64, 
      "signature" : sts.signature,
      "success_action_status" : 200,      
      "x-oss-security-token" : sts.SecurityToken,
      "callback" : sts.callbackBase64

    },
    success : onSuccess,
    fail : onFailed
  })
}

export const insertTask = (openToken, videoId, onSuccess, onFailed) => {
  wx.request({
    // "https://boju1.qdscitech.net"
    // url : serverUrl + "/api/open/task/insert" ,
    url : "https://boju1.qdscitech.net/api/open/task/insert",
    method : 'POST',
    dataType : 'json',
    header : {
      "Authorization" : "Bearer " + openToken
    },
    data: {
        "video_md5" : videoId
    },
    success : onSuccess,
    failed : onFailed
  })
}

export const writeVideoData = (userId,videoId, taskId, onSuccess, onFailed) => {
  wx.request({
    url : serverUrl + "/v1/app/writeVideoData" ,
    method : 'POST',
    dataType : 'json',
    data :  {
        "programCode" : programCode,
        "user_id" : userId, 
        "video_id" : videoId,
        "task_id" : taskId
    },
    success : onSuccess,
    failed : onFailed
  })
}



  



