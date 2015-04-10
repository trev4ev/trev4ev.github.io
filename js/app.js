$(document).ready(function(){
    var t = new Trianglify();
var pattern = t.generate(document.body.clientWidth, document.body.clientHeight);
document.body.setAttribute('style', 'background-image: '+pattern.dataUrl);
    $('#spacer').css("margin-top", window.innerHeight);
    $('h1').hide();
    $('.button').hide();
    $('h1').delay(1000).fadeIn(1000);
    $('.button').delay(1400).fadeIn(700);
});

$('#scroll').click(function(){
    $('html, body').animate({
    scrollTop: $("#spacer").offset().top
}, 1000);
});

$('.button').hover(function(){
    $('.button').animate({backgroundColor:'white', color: '#806bc9'});
}, function(){
    $('.button').animate({backgroundColor: 'rgba(0, 0, 0, 0)' , color: 'white'});
});