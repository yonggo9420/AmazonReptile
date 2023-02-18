//亚马逊电商网站爬虫
//版本:V1
//开发者:吴照勇
//2023‎年‎2‎月‎15‎日，‏‎16:32:22-----‎2023‎年‎2‎月‎18‎日，‏‎21:43:51
//依赖库安装:npm i request fs mysql puppeteer
const req = require('request');
const fs = require('fs')
const mysql = require('mysql')
const puppeteer = require('puppeteer');
const connection = mysql.createConnection({
	host: 'localhost',
	user: 'root',
	password: '',
	port: '3306',
	database: 'sunshop'
});
//新增商品数量
let productTotal = 0;
//新增商品图片数量
let productImgTotal = 0;
//程序执行开始时间
let beginDate;
let browser;
let page;
//日志内容
let logInfo = `日志记录开始:\n`;
let config = {
	//手动设置获取哪些二级分类的商品
	twoCateIndexMap:{
		'10':[0],
		'11':[0],
		'12':[0],
		'13':[0],
		'14':[0],
		'15':[0]
	},
	//是否开启全自动模式，请将isRunDownloadGetCategories和isRunProductMain关闭
	isRunAutoProductMain:false,
	//在线获取还是从本地获取分类信息(true为本地)
	islocalCate:true,
	//是否开启获取商品信息主方法(true为开启)(不可与全自动模式同时开启)
	isRunProductMain:true,
	//是否下载亚马逊最新分类信息(true为开启)
	isDownloadGetCategories:false,
	//是否运行获取最新分类信息主方法(true为开启)(不可与全自动模式同时开启)
	isRunDownloadGetCategories:false,
	//是否下载每个二级分类下所有商品信息到本地
	idDownloadProductArrInfo:false,
	//日志保存方式覆盖还是另外新建？(true为覆盖)
	isRewriteLog:false,
	//是否保存日志(true为是)
	isSaveLog:true,
	//日志存放路径,请不要添加文件后缀名
	logFilePath:'./log/log',
	//日志文件后缀名
	logFileType:'txt',
	//是否更新数据库分类信息(true为开启)
	isRunUpdateCategoriesMain:false,
	//网站域名('默认亚马逊请勿更改')
	baseUri:`https://www.amazon.cn`,
	//商品默认库存
	defStock:100,
	//商品默认主图ID
	defImgId:0,
	//商品默认是否为热门商品(1为是,0为否)
	defHot:1,
	//商品默认是否上架(0为是,1为否)
	defFlag:0,
	//商品图片名称默认前缀名
	PRODUCT_IMAGE_KEY:'PRODUCT_IMAGE_',
	//图片保存地址(结尾不加/)
	downloadImagePath:'D:/桌面/作业及资料/Java相关/实训/吴照勇/SUNSHOP后端/源码/src/main/resources/static'
}


//定制化处理
const DIYFunc = {
	"insertCategories":{
		"querySql":(name,pid)=>{
			return pid?"INSERT INTO `sunshop`.`categories`(`name`, `parent_id`, `create_time`, `update_time`) VALUES (?, ?,?, ?)":"INSERT INTO `sunshop`.`categories`(`name`,  `create_time`, `update_time`) VALUES ( ?,?, ?)";
		},
		"queryParams":(name,pid)=>{
			return pid?[name,pid,dateformat(new Date(), "yyyy-MM-dd hh:mm:ss"),dateformat(new Date(), "yyyy-MM-dd hh:mm:ss")]:[name,dateformat(new Date(), "yyyy-MM-dd hh:mm:ss"),dateformat(new Date(), "yyyy-MM-dd hh:mm:ss")];
		}
	},
	"queryCategoriesHasName":{
		
		"querySql":(name)=>{
			return 'SELECT * FROM  `categories` WHERE name = ?';
		},
		"queryParams":(name)=>{
			return [name];
		}
	},
	"setProductMainImg":{
		"querySql":(pid,imgId)=>{
			return 'UPDATE `sunshop`.`products` SET `image_id` = ? WHERE `id` = ?';
		},
		"queryParams":(pid,imgId)=>{
			return [imgId,pid];
		}
	},
	"insertImage_ProductInfo":{
		"querySql":(pid,imgId)=>{
			return 'INSERT INTO `product_images`(`product_id`, `image_id`) VALUES (?, ?)';
		},
		"queryParams":(pid,imgId)=>{
			return [pid,imgId];
		}
	},
	"insertImageInfo":{
		"querySql":(fileName,imgMime)=>{
			return 'INSERT INTO `images`(`url`, `name`, `mime`, `create_time`) VALUES (?, ?, ?, ?)';
		},
		"queryParams":(fileName,imgMime)=>{
			return [`/static/${fileName}`,fileName,imgMime,dateformat(new Date(), "yyyy-MM-dd hh:mm:ss")];
		}
	},
	"insertProduct":{
		"querySql":(title,cateId,to_price,cost_price,describe)=>{
			return 'INSERT INTO `products`(`title`, `image_id`, `category_id`, `to_price`, `cost_price`, `stock`, `hot`, `describe`, `created_at`, `updated_at`, `flag`) VALUES(?,?,?,?,?,?,?,?,?,?,?)';
		},
		"queryParams":(title,cateId,to_price,cost_price,describe)=>{
			return [title,config.defImgId,cateId,to_price,cost_price,config.defStock,config.defHot,describe,dateformat(new Date(), "yyyy-MM-dd hh:mm:ss"),dateformat(new Date(), "yyyy-MM-dd hh:mm:ss"),config.defFlag];
		}
	},
	"queryProductHasCategory":{
		"querySql":(categoryId)=>{
			return 'SELECT * FROM  `products` WHERE `category_id` = ?';
		},
		"queryParams":(categoryId)=>{
			return [categoryId];
		}
	}
	
}


const main = async (uri) => {
	beginDate = dateformat(new Date(), "yyyy-MM-dd hh:mm:ss");
	initTaskLog();	
	//全自动模式
	if(config.isRunAutoProductMain){
	addLog('----->正在执行全自动模式')
	await autoProductMain();
	}
	//获取所有分类信息
	if(config.isRunDownloadGetCategories&&!config.isRunAutoProductMain){
	addLog('----->正在执行获取所有分类信息')
	await getCategories(config.isDownloadGetCategories);
	}
	//更新数据库分类信息
	if(config.isRunUpdateCategoriesMain){
	addLog('----->正在执行更新数据库分类信息')
	await updateCategoriesMain();
	}
	//执行获取商品信息主方法
	if(config.isRunProductMain&&!config.isRunAutoProductMain){
	addLog('----->正在执行执行获取商品信息主方法')
	await productMain();
	}
	//保存日志
	if(config.isSaveLog){
	addLog('----->正在执行保存日志')
	addLog('----->程序结束')
	addLog(`----->开始时间:[${beginDate}]`)
	addLog(`----->结束时间:[${dateformat(new Date(), "yyyy-MM-dd hh:mm:ss")}]`)
	addLog(`----->新增商品:[${productTotal}] 件`)
	addLog(`----->新增商品图片:[${productImgTotal}] 张`)
	await saveLog();
	}
	addLog(`关闭浏览器`);
	browser.close();
	connection.end();
}

const initTaskLog = ()=>{
		addLog('程序任务:')
		//获取所有分类信息
		if(config.isRunDownloadGetCategories){
		addLog('----->获取所有分类信息')
		}
		//更新数据库分类信息
		if(config.isRunUpdateCategoriesMain){
		addLog('----->更新数据库分类信息')
		}
		//执行获取商品信息主方法
		if(config.isRunProductMain){
		addLog('----->执行获取商品信息主方法')
		}
		//保存日志
		if(config.isSaveLog){
		addLog('----->保存日志')
		}
		
		addLog('----->程序结束')
	}
	


const autoProductMain = ()=>{
	return new Promise( async(resolve)=>{
	let categories ;
	//获取所有分类信息
	addLog('----->正在执行获取所有分类信息')
	if(config.islocalCate){
		addLog(`正在从本地读取./categoriesInfo.json文件获取分类信息`)
		categories = await readFile("./categoriesInfo.json");
		//初始化浏览器
		addLog("初始化浏览器")
		await initBrowser();
	}else{
		addLog(`正在从亚马逊在线获取最新分类信息`)
		categories = await getCategories(config.isDownloadGetCategories);
	}
	//遍历所有二级分类
	addLog(`遍历所有二级分类`)
	for(let item1 of Object.values(categories.twoCateMap)){
		for(item2 of item1){
			addLog(`当前二级分类:${item2.name},nodeId:${item2.nodeId}`)
			//查询分类表中当前二级名称是否存在，并获取其ID
			let {hasName,id} = await queryCategoriesHasName(item2.name);
			addLog(`当前二级分类:${hasName?'存在':'不存在'},Id为:${id}`)
			//当二级分类查询不存在时，可判断是否新增该分类
			//....
			if(hasName){
				//查询商品表中当前二级分类ID的商品是否存在
				let {hasProduct,count} = await queryProductHasCategory(id);
				addLog(`当前二级分类:${hasProduct?`存在商品(${count}个)`:`不存在商品`}`)
				//如果商品不存在即是没有录入，执行录入当前二级分类所有商品主方法
				if(!hasProduct){
					addLog('----->正在执行执行获取商品信息主方法')
					addLog(`二级分类名称为${item2.name}`);
					await simpleTwoCateAllProduct(item2.nodeId,item2.name);
				}
			}else{
				addLog(`当前二级分类${item2.name}不存在,跳过`)
			}
			
		}
	}
	resolve();
	});
}

//查询商品表中指定二级分类是否有商品
//返回参数
//hasProduct 是否有商品
//count 商品数量
const queryProductHasCategory = (categoryId)=>{
	return new Promise((resolve)=>{
		//配置新增商品信息字段
		let querySql =DIYFunc.queryProductHasCategory.querySql(categoryId);
		let queryParams = DIYFunc.queryProductHasCategory.queryParams(categoryId);
		//新增商品信息
		  connection.query(querySql, queryParams, (err, result) => {
			if (err) {
				addLog('添加到数据库操作失败- ', err.message);
				return;
			}
			resolve({hasProduct:result&&result.length>0?true:false,count:result&&result.length>0?result.length:0});
		});
	})
}




const initBrowser = ()=>{
	return new Promise(async (resolve)=>{
		// 创建一个浏览器对象
		 browser = await puppeteer.launch({ //启动配置
		headless: false, // 使无头浏览器可见，便于开发过程当中观察
		ignoreDefaultArgs: ["--enable-automation"],
	})
		// 打开一个新的页面
		 page = await browser.newPage()
		 page.setDefaultTimeout(60000);
		 page.setExtraHTTPHeaders({
			 'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/110.0s'
		 });
		 await page.evaluateOnNewDocument(() => { //在每个新页面打开前执行以下脚本，否则会被识别出为chrome webdriver
				const newProto = navigator.__proto__;
				delete newProto.webdriver; //删除navigator.webdriver字段
				navigator.__proto__ = newProto;
				window.chrome = {}; //添加window.chrome字段，为增加真实性还需向内部填充一些值
				window.chrome.app = {
					"InstallState": "hehe",
					"RunningState": "haha",
					"getDetails": "xixi",
					"getIsInstalled": "ohno"
				};
				window.chrome.csi = function() {};
				window.chrome.loadTimes = function() {};
				window.chrome.runtime = function() {};
				Object.defineProperty(navigator, 'userAgent', { //userAgent在无头模式下有headless字样，所以需覆写
					get: () =>
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.113 Safari/537.36",
				});
				Object.defineProperty(navigator, 'plugins', { //伪装真实的插件信息
					get: () => [{
						"description": "Portable Document Format",
						"filename": "internal-pdf-viewer",
						"length": 1,
						"name": "Chrome PDF Plugin"
					}]
				});
				Object.defineProperty(navigator, 'languages', { //添加语言
					get: () => ["zh-CN", "zh", "en"],
				});
				const originalQuery = window.navigator.permissions.query; //notification伪装
				window.navigator.permissions.query = (parameters) => (
					parameters.name === 'notifications' ?
					Promise.resolve({
						state: Notification.permission
					}) :
					originalQuery(parameters)
				);
			})
		
		resolve();
	})
}





//获取当前二级分类主页面的所有商品URI
const getProductPath =  nodeId => {
	return new Promise(async (resolve) => {
		let  pathArr = true;
		// 设置页面的URL
		addLog(`打开新页面URI为:${config.baseUri}/s?rh=n:${nodeId}&fs=true`)
		await page.goto(encodeURI(`${config.baseUri}/s?rh=n:${nodeId}&fs=true`)).catch(async ()=>{
			await page.goto(encodeURI(`${config.baseUri}/s?rh=n:${nodeId}&fs=true`)).catch((err)=>{
				addLog(`页面无法加载${err.message}`);
			})
		})
		// other actions...
		await page.waitForSelector('.s-main-slot.s-result-list.s-search-results.sg-row').catch(()=>{
			pathArr =false;
		}) // 等待首页加载出来
		if(!pathArr){
			return resolve(pathArr);
		}
		
		pathArr = await page.evaluate(() => {
			let arr = [];
			document.querySelectorAll('h2>.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal').forEach((item,index)=>{
					arr.push(item.getAttribute("href"))
			})
			return arr;
		});
		resolve(pathArr);
	})
}



//根据当前商品URI，查询当前商品详情，并获取商品信息
const getProductInfoPage = (uri) => {
	return new Promise((resolve) => {
		setTimeout( async()=>{
			// 设置页面的URL
			addLog(`打开新页面URI为:${config.baseUri+uri}`)
			await page.goto(encodeURI(`${config.baseUri+uri}`))
			// other actions...
			let isPageOk = true;
			await page.waitForSelector('.a-unordered-list.a-nostyle.a-horizontal.list.maintain-height').catch((err)=>{
				isPageOk = false;
			}) // 等待首页加载出来
			if(!isPageOk){
				addLog("页面加载失败或页面内容不符合要求");
				return resolve(false);
			}
			let productInfo = await page.evaluate(() => {
			
				let obj = {};
				obj.imgPathArr = [];
				obj.title = document.querySelector('#productTitle').innerText.trim();
				obj.cost_price = '';
				if(document.querySelector('#ags_local_price')){
				let cost_priceStr = document.querySelector('#ags_local_price').innerText.trim().split('¥')[1];
				cost_priceStr.split(',').forEach((item, index) => obj.cost_price = obj.cost_price + item);
				obj.to_price = (parseFloat(obj.cost_price) * 1.3).toFixed(2);
				}else{
					obj.cost_price = parseFloat(Math.random()* 2000).toFixed(2);
					obj.to_price = (parseFloat(obj.cost_price) * 1.3).toFixed(2);
				}
				obj.describe = document.querySelector('#productDescription').innerText.trim();
				let imgListItem = document.querySelectorAll(
					"li.a-spacing-small.item.imageThumbnail.a-declarative>span.a-list-item>span.a-button.a-button-thumbnail.a-button-thumbnail.a-button-toggle>span.a-button-inner>span.a-button-text"
					);
				for (let el of imgListItem) {
					el.click();
				}
				const ImgItemList = document.querySelectorAll("div.imgTagWrapper>img.a-dynamic-image");
			
				for (var imgEl of ImgItemList) {
					obj.imgPathArr.push(imgEl.getAttribute('src'))
				}
				return obj;
			
			});
			resolve(productInfo);
		},3000);
	})
}



const insertProduct = (productInfo)=>{
	return new Promise((resolve)=>{
		//配置新增商品信息字段
		let querySql =DIYFunc.insertProduct.querySql(productInfo.title,productInfo.cateId,productInfo.to_price,productInfo.cost_price,productInfo.describe);
		let queryParams = DIYFunc.insertProduct.queryParams(productInfo.title,productInfo.cateId,productInfo.to_price,productInfo.cost_price,productInfo.describe);
		//新增商品信息
		  connection.query(querySql, queryParams, (err, result) => {
			if (err) {
				addLog('数据库操作失败- ', err.message);
				return;
			}
			resolve(result.insertId);
		});
	})
}





const ImageFunc =   (pid,uri)=>{
	return new Promise( (resolve)=>{
		setTimeout(async ()=>{
			let fileType = uri.split('.').pop();
			let fileName = `${config.PRODUCT_IMAGE_KEY+new Date().getTime()}.${fileType}`;
			let imgMime = `image/${fileType}`
			//保存图片
			addLog(`正在保存图片,图片信息为(文件名:${fileName},文件类型:${imgMime},文件后缀:${fileType})`);
			req(uri).pipe(fs.createWriteStream(`${config.downloadImagePath}/${fileName}`));
			productImgTotal++;
			addLog(`开始向数据库写入图片信息`);
			let imgId = await insertImageInfo(fileName,imgMime);
			addLog(`写入结束ID:${imgId}`);
			addLog(`开始向数据库写入图片与商品关系信息`);
			let img_productId = await insertImage_ProductInfo(pid,imgId);
			addLog(`写入结束ID:${img_productId}`);
			
			resolve({imgId:imgId,pid:pid});
		},2000);
	});
}




//配置新增商品图片信息字段
const insertImageInfo = (fileName,imgMime)=>{
	return new Promise((resolve)=>{
		let querySql =DIYFunc.insertImageInfo.querySql(fileName,imgMime);
		let queryParams = DIYFunc.insertImageInfo.queryParams(fileName,imgMime);
		//新增商品图片信息
		 connection.query(querySql, queryParams,  (err, result) => {
			if (err) {
				addLog('数据库操作失败- ', err.message);
				return;
			}
			resolve(result.insertId);
		})
	});
}





//配置新增商品图片关系信息字段
const insertImage_ProductInfo = (pid,imgId)=>{
	return new Promise((resolve)=>{
		let querySql =DIYFunc.insertImage_ProductInfo.querySql(pid,imgId);
		let queryParams = DIYFunc.insertImage_ProductInfo.queryParams(pid,imgId);
		//新增商品图片关系信息
		 connection.query(querySql, queryParams,  (err, result) => {
			if (err) {
				addLog('数据库操作失败- ', err.message);
				return;
			}
			resolve(result.insertId);
		})
	});
}

//设置最后一张图片ID为当前商品主图
const setProductMainImg = (pid,imgId)=>{
	return new Promise((resolve)=>{
		let querySql =DIYFunc.setProductMainImg.querySql(pid,imgId);
		let queryParams = DIYFunc.setProductMainImg.queryParams(pid,imgId);
		connection.query(querySql, queryParams,  (err, result) => {
			if (err) {
				addLog('数据库操作失败- ', err.message);
				return;
			}
			resolve();
		})
	});
}






//获取一个二级分类下主页面所有商品信息,并下载其获取到的商品图片
//name为二级分类名称
const simpleTwoCateAllProduct =  (nodeId,name) => {
	return new Promise(async (resolve)=>{
	let productInfoArr = [];
	//获取当前二级分类主页面的所有商品URI
	addLog(`获取当前二级分类主页面的所有商品URI${name}——>${nodeId}`);
	let pathArr = await getProductPath(nodeId);
	if(!pathArr)
	{
		addLog(`当前二级分类没有商品信息`);
		return resolve();
	}
	//遍历获取每个商品信息
	for (let num = 0; num < pathArr.length; num++) {
		addLog(`遍历获取第${num+1}个商品信息`);
		//根据当前商品URI，查询当前商品详情，并获取商品信息
		let productInfo = await getProductInfoPage(pathArr[num]);
		if(!productInfo){
			break;
		}
		addLog(`查询，设置第${num+1}个商品所属分类id`);
		//==查询，设置当前商品所属分类id
		let {hasName,id} = await queryCategoriesHasName(name);
		addLog(`查询成功:第${num+1}个商品对应二级分类${hasName?'存在':'不存在'},ID为:${id}`);
		if(!hasName){
			addLog(`nodeId:${nodeId}的商品二级分类${name}不存在`);
			return;
		}
		productInfo.cateId = id;
		
		addLog(`将第${num+1}个商品新增到数据库`);
		productInfo.id = await insertProduct(productInfo);
		addLog(`新增完成ID:${productInfo.id}`);
		productTotal++;
		productInfoArr.push(productInfo);
	}
	//下载当前所有商品信息
	if(config.idDownloadProductArrInfo){
	addLog(`下载当前二级分类:${name}的所有商品信息`);
	fs.appendFile(`./productArrInfo_${name}.json`,JSON.stringify(productInfoArr),err=>err?addLog(`./productArrInfo_${name}.json写入失败`):addLog(`./productArrInfo_${name}.json写入失败成功`));
	}
	// if(!config.isRunAutoProductMain){
	// 	addLog(`商品信息获取,新增数据库完毕,关闭浏览器`);
	// 	browser.close();
	// }
	//上传商品图片
	for(let item1 of productInfoArr){
		let imgId;
		let pid;
		for(let item2 of item1.imgPathArr){
			addLog(`下载数据库中ID为:${item1.id}商品的商品图片,图片uri:${item2}`);
			 let  obj = await ImageFunc(item1.id,item2);
			 imgId = obj.imgId;
			 pid = obj.pid;
		}
		addLog(`设置ID为:${pid}的商品主图为:${imgId}`);
		await setProductMainImg(pid,imgId);
		addLog(`设置结束`);
	}
	addLog(`二级分类:${name}的所有商品图片操作完毕`);
	resolve();
});
}



const readFile = (filePath)=>{
	return new Promise((resolve)=>{
		fs.readFile(filePath,(err,data)=>{
		    if (err) {
		        addLog("读取错误")
		        return;
		    }
			resolve(JSON.parse(data.toString()));
		})
	})
	
}


const addLog = str=>{
	logInfo = `${logInfo}[${dateformat(new Date(), "yyyy-MM-dd hh:mm:ss")}]----->${str}\n`;
	console.log(str);
}


const  dateformat = (date,format) =>{
	var o = {
		"M+": date.getMonth() + 1, //month
		"d+": date.getDate(), //day
		"h+": date.getHours(), //hour
		"m+": date.getMinutes(), //minute
		"s+": date.getSeconds(), //second
		"q+": Math.floor((date.getMonth() + 3) / 3), //quarter
		"S": date.getMilliseconds() //millisecond
	}
	if (/(y+)/.test(format)) format = format.replace(RegExp.$1,
		(date.getFullYear() + "").substr(4 - RegExp.$1.length));
	for (var k in o)
		if (new RegExp("(" + k + ")").test(format))
			format = format.replace(RegExp.$1,
				RegExp.$1.length == 1 ? o[k] :
				("00" + o[k]).substr(("" + o[k]).length));
	return format;
}



const productMain = ()=>{
	return new Promise(async (resolve)=>{
	//
	let categories ;
	if(config.islocalCate){
		addLog(`正在从本地读取./categoriesInfo.json文件获取分类信息`)
		categories = await readFile("./categoriesInfo.json");
		//初始化浏览器
		addLog("初始化浏览器")
		await initBrowser();
	}else{
		addLog(`正在从亚马逊在线获取最新分类信息`)
		categories = await getCategories(config.isDownloadGetCategories);
	}
	let oneCateIndexList = Object.keys(config.twoCateIndexMap);
	let twoCateIndexList = Object.values(config.twoCateIndexMap);
	for(let i in oneCateIndexList){
		let oneCate = categories.oneCateMap[oneCateIndexList[i]];
		if(oneCate){
			//获取一级分类的名称
			let oneCatename = oneCate;
			addLog(`读取到索引为${oneCateIndexList[i]}的一级分类名称为${oneCatename}`);
			for(let t of twoCateIndexList[i]){
				let twoCate = categories.twoCateMap[oneCateIndexList[i]][t];
				if(twoCate){
					let nodeId = twoCate.nodeId;
					addLog(`读取到索引为${twoCateIndexList[i]}的二级分类名称为${twoCate.name}`);
					
					addLog(`当前二级分类:${twoCate.name},nodeId:${twoCate.nodeId}`)
					//查询分类表中当前二级名称是否存在，并获取其ID
					let {hasName,id} = await queryCategoriesHasName(twoCate.name);
					addLog(`当前二级分类:${hasName?'存在':'不存在'},Id为:${id}`)
					//当二级分类查询不存在时，可判断是否新增该分类
					//....
					if(hasName){
						//查询商品表中当前二级分类ID的商品是否存在
						let {hasProduct,count} = await queryProductHasCategory(id);
						addLog(`当前二级分类:${hasProduct?`存在商品(${count}个)`:`不存在商品`}`)
						//如果商品不存在即是没有录入，执行录入当前二级分类所有商品主方法
						if(!hasProduct){
							addLog('----->正在执行执行获取商品信息主方法')
							addLog(`二级分类名称为${twoCate.name}`);
							await simpleTwoCateAllProduct(twoCate.nodeId,twoCate.name);
						}
					}else{
						addLog(`当前二级分类${twoCate.name}不存在,跳过`)
					}
				}
				else{
					addLog('twoCateIndexMap参数配置有误');
					return;
				}
				
			}
			
		}
		else{
			addLog('twoCateIndexMap参数配置有误');
			return;
		}
	
	}
	addLog(`获取商品信息主方法处理完毕`);
	resolve();
	});
}





const saveLog = ()=>{
	return new Promise((resolve)=>{
		let fileName = config.isRewriteLog?`${config.logFilePath}.${config.logFileType}`:`${config.logFilePath+dateformat(new Date(), "yyyyMMddhhmmss")}.${config.logFileType}`;
			fs.writeFile(fileName,logInfo,(err)=>{
			    err?console.log("log.txt写入失败"):console.log("log.txt写入成功");
				resolve();
			})
	})
}





//获取下载到本地的亚马逊分类JSON信息，更新到本地数据库
//----------------------------------------------------------------------


//获取亚马逊在线分类信息，可下载到本地
const getCategories = (isDownloa)=>{
	
	return new Promise(async (resolve) => {
		//初始化浏览器
		await initBrowser();
		// 设置页面的URL
		await page.goto(encodeURI(config.baseUri))
		// other actions...
		await page.waitForSelector('#nav-hamburger-menu') // 等待加载出来
		//await autoScroll(page); // 滚到到底部（高度可以自己计算），保证爬取部分全部加载
	
		// await page.waitForSelector('.a-unordered-list.a-nostyle.a-horizontal.list.maintain-height>li:nth-child(5)') // 等待爬取内容加载完成
		await page.click("#nav-hamburger-menu")
		await page.waitForSelector('a.hmenu-item.hmenu-compressed-btn') // 等待加载出来
		await page.waitForTimeout(2000);
		 let  categories = await page.evaluate(() => {
			  let cateInfo = {};
			  cateInfo.oneCateMap = {};
			  cateInfo.twoCateMap = {};
			  let oneCateNodeList = document.querySelectorAll("ul>li>a.hmenu-item[data-ref-tag][data-menu-id]");
				for(let item of oneCateNodeList){
						cateInfo.oneCateMap[item.getAttribute("data-menu-id")] = item.innerText;
			  }
			  
			  let twoCateNodeList = document.querySelectorAll("ul.hmenu>li>a.hmenu-item[href*='/gp/browse.html?node=']");
			  for(let item of twoCateNodeList){
						let obj = {};
						obj.name = item.text;
							obj.nodeId=item.getAttribute("href").split('&')[0].split('=').pop();
				
				  if(cateInfo.twoCateMap[item.parentElement.parentElement.getAttribute('data-menu-id')]&&cateInfo.twoCateMap[item.parentElement.parentElement.getAttribute('data-menu-id')].length>0){
					cateInfo.twoCateMap[item.parentElement.parentElement.getAttribute('data-menu-id')].push(obj);
				  }else{
					cateInfo.twoCateMap[item.parentElement.parentElement.getAttribute('data-menu-id')]=[];
					cateInfo.twoCateMap[item.parentElement.parentElement.getAttribute('data-menu-id')].push(obj);
				  }
			  }
			  addLog(cateInfo)
			  return cateInfo;
		})
		//下载当前所有分类信息
		isDownloa?fs.writeFile('./categoriesInfo.json',JSON.stringify(categories),(err)=>{ // \n为换行符
		    err?addLog("categoriesInfo.json写入失败"):addLog("categoriesInfo.json写入成功");
			resolve(categories);
		}):resolve(categories);
		addLog(`关闭浏览器`);
		browser.close();
	})
	
}


//查询本地数据库中是否有对应name的分类
const queryCategoriesHasName = (name) => {
	return new Promise((resolve) => {
		let querySql = DIYFunc.queryCategoriesHasName.querySql(name);
		let queryParams = DIYFunc.queryCategoriesHasName.queryParams(name);
		connection.query(querySql, queryParams, (err, res) => {
			resolve({hasName:res&&res.length>0?true:false,id:res&&res.length>0?res[0].id:null});
		});
	})
}

//新增分类信息
const insertCategories = (name,pid) => {
	return new Promise((resolve) => {
		let querySql = DIYFunc.insertCategories.querySql(name,pid);
		let queryParams = DIYFunc.insertCategories.queryParams(name,pid);
		connection.query(querySql, queryParams, (err, res) => {
			    if(err){
			         addLog('[INSERT ERROR] - ',err.message);
			         return;
			        }        
			 addLog(res)
			resolve(res.insertId);
		});
	})
}






//更新数据库分类信息(获取在线数据或本地数据)
//type1: true or false(true为在线获取)
//在线获取 或 读取本地categoriesInfo.json
const updateCategoriesMain = (type1 = false) => {
	return new Promise(async (resolve)=>{
		let cateInfo = await new Promise(async (resolve) => {
			if(type1){
				let info = await getCategories(true);
				resolve(info);
			}else{
				fs.readFile('./categoriesInfo.json', (err, data) => {
					if (err) {
						addLog("读取错误")
						return;
					}
					resolve(JSON.parse(data.toString()));
				})
			}
			
		})
		let oneCateMap = cateInfo.oneCateMap;
		let twoCateMap = cateInfo.twoCateMap;
		//更新数据库中的一级目录
		for (let i in oneCateMap) {
			let {hasName,id} = await queryCategoriesHasName(oneCateMap[i]);
			let oneId;
			if(!hasName){
				oneId = await insertCategories(oneCateMap[i],null)
			}
			for (let item of twoCateMap[i]) {
					let {hasName,id} = await queryCategoriesHasName(item.name);
					if(!hasName){
						await insertCategories(item.name,oneId)
					}
			}
		}
		addLog("分类更新结束")
		resolve();
	})
	
}
//-----------------------------------------------------------------------
main();
