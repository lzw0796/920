(function ($) {
    window.XH_Plugins_Custom={
        data:{},

        xh_now_pay_model_show:function (params) {
            if(params.modal){
                switch (params.modal){
                    case 'shopping_one_step':
                        XH_Plugins_Custom.__ajax(params,XH_Plugins_Custom.show_model_qrcode);
                        break;
                    case 'shopping_cart':
                        XH_Plugins_Custom.__ajax(params,XH_Plugins_Custom.redirect_cart);
                        break;
                    default:
                        XH_Plugins_Custom.data={};
                        window.xh_pay_lock = false;
                        $('#xh_now_pay_modal').show();
                        XH_Plugins_Custom.__ajax(params,XH_Plugins_Custom.bind_url);
                }
            }
        },

        close_model:function () {
            $(".xunhu-modal").each(function(){
                $(this).hide();
            });
        },

        bind_url:function(_data) {
            XH_Plugins_Custom.data['url']=_data['url'];
        },

        show_model_qrcode:function(data){
            $("#xh_now_pay_modal_2 .modal-price").html(data.price_html);
            $("#xh_now_pay_modal_2_qrcode").attr("src", data.qrcode_url);
            $('#xh_now_pay_modal_2').show();
            console.log(data);
        },

        redirect_cart:function (data) {
            location.href=data;
        },

        xh_buy_membership_model_show:function () {
            XH_Plugins_Custom.data={
                buy_membership:'pay_mode'
            };

            $('.xh-membership-type').each(function () {
                if($(this).is('.active')){
                    XH_Plugins_Custom.data['membership_id']=$(this).data('id');
                }
            });

            $('#xh_buy_membership_model').show();
        },

        show_or_hide_membership_notes:function (obj,containerID) {
            var currentNode=$('#'+containerID);

            if($(obj).hasClass('xunhu-up-icon')){
                $(obj).removeClass('xunhu-up-icon');
                $(obj).addClass('xunhu-down-icon');
            }else {
                $(obj).removeClass('xunhu-down-icon');
                $(obj).addClass('xunhu-up-icon');
            }

            if(currentNode.is(':hidden')){
                currentNode.show();
            }else{
                currentNode.hide();
            }
        },

        xh_membership_type_sel:function (currentObj) {
            $('.xh-membership-type').each(function () {
                $(this).removeClass('active');
            });

            $(currentObj).addClass('active');
            XH_Plugins_Custom.data['membership_id']=$(currentObj).data('id');
        },

        xh_buy_membership_mode_sel:function (obj) {
            var showModeID=$(obj).attr('id');
            var hideModeID='code_mode';

            if(showModeID==='code_mode'){
                hideModeID='pay_mode';
            }

            var showModeContainerID=showModeID+'_container';
            var hideModeContainerID=hideModeID+'_container';

            XH_Plugins_Custom.show_buy_membership_mode(showModeID,showModeContainerID);
            XH_Plugins_Custom.hide_buy_membership_mode(hideModeID,hideModeContainerID);

            XH_Plugins_Custom.data['buy_membership']=showModeID;
        },

        show_buy_membership_mode:function (showModeID,showModeContainerID) {
            if(!($('#'+showModeID).is('.active'))){
                $('#'+showModeID).addClass('active');
            }

            $('#'+showModeContainerID).show();
        },

        hide_buy_membership_mode:function (hideModeID,hideModeContainerID) {
            $('#'+hideModeID).removeClass('active');
            $('#'+hideModeContainerID).hide();
        },

        xh_now_pay:function(source,params){
            if(!source)return;

            switch (source){
                case 'xh_now_pay_modal':

                    if(!XH_Plugins_Custom.data['url']) return;

                    if(window.xh_pay_lock){
                        return false;
                    }

                    window.xh_pay_lock = true;

                    var $btn = $("#xh_now_pay_modal .btn-success");

                    if(!$btn.length){
                        $btn = $("#xh_now_pay_modal button, #xh_now_pay_modal a").filter(function(){
                            return ($(this).text() || '').indexOf('立即支付') !== -1;
                        }).first();
                    }

                    $btn.attr('data-old-text', $btn.text());
                    $btn.text('正在跳转>>>');
                    $btn.prop('disabled', true);
                    $btn.css({
                        opacity:'0.6',
                        cursor:'not-allowed',
                        pointerEvents:'none'
                    });

                    var payment=$('#xh_now_pay_modal input:radio[name="payment"]:checked').val();

                    var _params={
                        url:XH_Plugins_Custom.data['url'],
                        type:'POST',
                        data:{
                            payment_method:payment
                        }
                    };

                    XH_Plugins_Custom.__ajax(_params,XH_Plugins_Custom.pay);
                    break;

                case 'xh_buy_membership_model':

                    if(window.xh_pay_lock){
                        return false;
                    }

                    window.xh_pay_lock = true;

                    XH_Plugins_Custom.__ajax(params,XH_Plugins_Custom._pay);
                    break;
            }
        },

        _pay:function (_data) {
            XH_Plugins_Custom.pay(_data['redirect_url']);
        },

        pay:function (_data) {
            window.xh_pay_lock = false;
            location.href=_data;
        },

        reset_pay_button:function(){
            window.xh_pay_lock = false;

            var $btn = $("#xh_now_pay_modal .btn-success");

            if(!$btn.length){
                $btn = $("#xh_now_pay_modal button, #xh_now_pay_modal a").filter(function(){
                    return ($(this).text() || '').indexOf('正在跳转') !== -1;
                }).first();
            }

            if($btn.length){
                var oldText = $btn.attr('data-old-text') || '立即支付';

                $btn.text(oldText);
                $btn.prop('disabled', false);
                $btn.css({
                    opacity:'',
                    cursor:'',
                    pointerEvents:''
                });
            }
        },

        __ajax:function (params,callback) {
            if(!params) return;
            if(!params.url) return;
            if(!params.type) params.type='POST';
            if(!params.data) params.data={};

            $.ajax({
                url: params.url,
                type: params.type,
                timeout: 60*1000,
                cache: false,
                data: params.data,
                dataType: 'json',
                success: function(res) {
                    if(res.errcode!=0){
                        console.log(res);

                        XH_Plugins_Custom.reset_pay_button();

                        if(res.errcode!==501){
                            $('#xh_buy_model_error_notice').html(res.errmsg);
                        }

                        $('#xh_buy_model_error_notice').show();
                        return;
                    }

                    callback(res.data);
                },
                error:function(e){
                    console.log(e);
                    XH_Plugins_Custom.reset_pay_button();
                    alert('支付请求失败，请稍后重试');
                }
            });
        }
    };
})(jQuery);
