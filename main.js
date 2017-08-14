/**
 * Created by guhao on 2017/8/10.
 */

/*todo:
 1. query 获取上传host
 2. 组件化
 */

$(function() {


    var options = {
        host : "http://upload.qiniu.com",
        tokenUrl : "http://localhost:8083/uptoken",
        domain : "http://orqjqg7zj.bkt.clouddn.com/",
        mockToken : true,
        mockTokenValue : "FMVCRs2-LO1ivRNi4l7mEZE6ZDvPv-519D12kZCO:ZXOlC4-SKwZfalWNIvXUNUZg1wA=:eyJzY29wZSI6InJ0Y3Rlc3QiLCJkZWFkbGluZSI6MjUwMjY5NjAxNH0=",
        hash : true
    }


    var uploader = WebUploader.create({
        auto: true,
        swf: "Uploader.swf",
        server: options.host,
        pick: "#picker",
        resize: false,
        dnd: "#theList",
        paste: document.body,
        disableGlobalDnd: true,
        thumb: {
            width: 100
            , height: 100
            , quality: 70
            , allowMagnify: true
            , crop: true
        },
        accept : [
            {
                title: 'Images',
                extensions: 'gif,jpg,jpeg,bmp,png',
                mimeTypes: 'image/*'
            },
            {
                title: 'Videos',
                extensions: 'mp4,mkv,avi',
                mimeTypes: 'video/*'
            }
        ],
        compress: false,
        prepareNextFile: true,
        chunked: true,
        chunkSize: 4194304,
        threads: 5,
        fileNumLimit: 100,
        fileSingleSizeLimit: 10000 * 1024 * 1024,
        duplicate: true
    });

    var token;
    var m = new Map();

    uploader.on("fileQueued", function (file) {

        $("#theList").append('<li id="' + file.id + '">' +
            '<img /><span>' + file.name + '</span><span class="itemUpload">上传</span><span class="itemStop">暂停</span><span class="itemDel">删除</span>' +
            '<div class="percentage"></div>' +
            '<a id="url" href="http://www.qiniu.com">url</a>' +
            '</li>');

        var $img = $("#" + file.id).find("img");

        uploader.makeThumb(file, function (error, src) {
            if (error) {
                $img.replaceWith("<span>不能预览</span>");
            }

            $img.attr("src", src);
        });

        var ctx = new Array();
        m.set(file.name, ctx);

    });


    uploader.on("uploadStart", function(file){
        if(!options.mockToken) {
            GetToken(options.tokenUrl, file);
        } else {
            uploader.options.formData = {
                token : options.mockTokenValue
            }
            token = options.mockTokenValue;
        }
    });

    uploader.on("uploadBeforeSend", function (block, data, headers) {
        console.log("uploadBeforeSend............")
        if (parseInt(block.file.size) <= parseInt(uploader.options.chunkSize)) {
            uploader.options.chunked = false;
            console.log("使用表单上传.........");
        } else {
            uploader.options.chunked = true;
            headers['Authorization'] = 'UpToken ' + token;
            headers['Content-Type'] = 'application/octet-stream';
            block.transport.options.server = options.host + "/mkblk/" + (block.end - block.start);
            block.transport.options.sendAsBinary = true;
            block.transport.options.formData = false;
            console.log(true);
        }
    });

    uploader.on("uploadProgress", function (file, percentage) {
        $("#" + file.id + " .percentage").text(percentage * 100 + "%");
    });

    uploader.on("uploadAccept", function (block, ret) {
        console.log("uploadAccept.............");
        //ctx[block.chunk] = ret.ctx;
        console.log("block.file.name:" + block.file.name);
        m.get(block.file.name)[block.chunk] = ret.ctx;
    });

    uploader.on("uploadSuccess", function(file, res) {
        console.log("uploadSuccess............");
        console.log(res);
        if(parseInt(file.size) <= parseInt(uploader.options.chunkSize)) {
            UploadComplete(file,res);
            console.log(res);
        } else {
            MakeFile(m.get(file.name), file, options.hash);
        }

    });

 /*   uploader.on("uploadComplete", function (file) {
        console.log("uploadComplete............");
        console.log("file " + file);
        if(parseInt(file.size) >= parseInt(uploader.options.chunkSize)) {
            MakeFile(ctx, file, options.hash);
        }
    }); */


    $("#theList").on("click", ".itemUpload", function () {
        uploader.upload();

        //"上传"-->"暂停"
        $(this).hide();
        $(".itemStop").show();
    });

    $("#theList").on("click", ".itemStop", function () {
        uploader.stop(true);

        //"暂停"-->"上传"
        $(this).hide();
        $(".itemUpload").show();
    });

    $("#theList").on("click", ".itemDel", function () {
        uploader.removeFile($(this).parent().attr("id"));	//从上传文件列表中删除

        $(this).parent().remove();	//从上传列表dom中删除
    });

   function GetToken(tokenUrl, file) {
        $.ajax({
            async:false,
            type: 'get',
            url: tokenUrl,
            success: function (res) {
                console.log(res);
                token = res.uptoken;
                console.log(token);
                if(options.hash) {
                    uploader.options.formData = {
                        token : token,
                    }
                } else {
                    uploader.options.formData = {
                        token : token,
                        key: file.name
                    }
                }
            }
        });
    }

    function MakeFile(ctx, file, hash) {
        console.log("ctx:" + ctx);
        var b = ctx.join(",");
        if(hash){
            $.ajax({
                type: 'POST',
                url: options.host + '/mkfile/' + file.size,
                data: b,
                contentType: "text/plain",
                contentLength: b.length,
                beforeSend: function (XMLHttpRequest) {
                    XMLHttpRequest.setRequestHeader("Authorization", 'UpToken ' + token);
                },
                success: function(res){
                    UploadComplete(file, res);
                }
            });
        } else {
            $.ajax({
                type: 'POST',
                url: options.host + '/mkfile/' + file.size + '/key/' + URLSafeBase64Encode(file.name),
                data: b,
                contentType: "text/plain",
                contentLength: b.length,
                beforeSend: function (XMLHttpRequest) {
                    XMLHttpRequest.setRequestHeader("Authorization", 'UpToken ' + token);
                },
                success: function(res){
                    UploadComplete(file, res);
                }
            });
        }
    }

    function UploadComplete(file,res) {
        console.log(file);
        console.log(res);
        ctx = new Array();
        uploader.options.chunked = true;
        $("#" + file.id + " .percentage").text("上传完毕");
        $(".itemStop").hide();
        $(".itemUpload").hide();
        $(".itemDel").hide();
        $("#" + file.id + " .url").text(options.domain + res.key);
        $("#url").attr("href",options.domain + res.key).text(options.domain + res.key);
    }

    function URLSafeBase64Decode(data){
        data = data.replace(/_/g, '/').replace(/-/g, '+');
        var b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            dec = "",
            tmp_arr = [];

        if (!data) {
            return data;
        }

        data += '';

        do { // unpack four hexets into three octets using index points in b64
            h1 = b64.indexOf(data.charAt(i++));
            h2 = b64.indexOf(data.charAt(i++));
            h3 = b64.indexOf(data.charAt(i++));
            h4 = b64.indexOf(data.charAt(i++));

            bits = h1 << 18 | h2 << 12 | h3 << 6 | h4;

            o1 = bits >> 16 & 0xff;
            o2 = bits >> 8 & 0xff;
            o3 = bits & 0xff;

            if (h3 === 64) {
                tmp_arr[ac++] = String.fromCharCode(o1);
            } else if (h4 === 64) {
                tmp_arr[ac++] = String.fromCharCode(o1, o2);
            } else {
                tmp_arr[ac++] = String.fromCharCode(o1, o2, o3);
            }
        } while (i < data.length);

        dec = tmp_arr.join('');

        return dec;
    }

    function utf8_encode(argString) {

        if (argString === null || typeof argString === 'undefined') {
            return '';
        }

        var string = (argString + ''); // .replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        var utftext = '',
            start, end, stringl = 0;

        start = end = 0;
        stringl = string.length;
        for (var n = 0; n < stringl; n++) {
            var c1 = string.charCodeAt(n);
            var enc = null;

            if (c1 < 128) {
                end++;
            } else if (c1 > 127 && c1 < 2048) {
                enc = String.fromCharCode(
                    (c1 >> 6) | 192, (c1 & 63) | 128
                );
            } else if (c1 & 0xF800 ^ 0xD800 > 0) {
                enc = String.fromCharCode(
                    (c1 >> 12) | 224, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128
                );
            } else { // surrogate pairs
                if (c1 & 0xFC00 ^ 0xD800 > 0) {
                    throw new RangeError('Unmatched trail surrogate at ' + n);
                }
                var c2 = string.charCodeAt(++n);
                if (c2 & 0xFC00 ^ 0xDC00 > 0) {
                    throw new RangeError('Unmatched lead surrogate at ' + (n - 1));
                }
                c1 = ((c1 & 0x3FF) << 10) + (c2 & 0x3FF) + 0x10000;
                enc = String.fromCharCode(
                    (c1 >> 18) | 240, ((c1 >> 12) & 63) | 128, ((c1 >> 6) & 63) | 128, (c1 & 63) | 128
                );
            }
            if (enc !== null) {
                if (end > start) {
                    utftext += string.slice(start, end);
                }
                utftext += enc;
                start = end = n + 1;
            }
        }

        if (end > start) {
            utftext += string.slice(start, stringl);
        }

        return utftext;
    }

    function URLSafeBase64Encode(data) {
        var b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
        var o1, o2, o3, h1, h2, h3, h4, bits, i = 0,
            ac = 0,
            enc = '',
            tmp_arr = [];

        if (!data) {
            return data;
        }

        data = utf8_encode(data + '');

        do { // pack three octets into four hexets
            o1 = data.charCodeAt(i++);
            o2 = data.charCodeAt(i++);
            o3 = data.charCodeAt(i++);

            bits = o1 << 16 | o2 << 8 | o3;

            h1 = bits >> 18 & 0x3f;
            h2 = bits >> 12 & 0x3f;
            h3 = bits >> 6 & 0x3f;
            h4 = bits & 0x3f;

            // use hexets to index into b64, and append result to encoded string
            tmp_arr[ac++] = b64.charAt(h1) + b64.charAt(h2) + b64.charAt(h3) + b64.charAt(h4);
        } while (i < data.length);

        enc = tmp_arr.join('');

        switch (data.length % 3) {
            case 1:
                enc = enc.slice(0, -2) + '==';
                break;
            case 2:
                enc = enc.slice(0, -1) + '=';
                break;
        }

        return enc.replace(/\//g, '_').replace(/\+/g, '-');
    }
});