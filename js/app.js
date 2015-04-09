$(document).ready(function(){
    var pattern = Trianglify({
                height: window.innerHeight * 3,
                width: window.innerWidth,
                cell_size: 100,
                x_colors: 'Purples'
            });
            document.body.appendChild(pattern.canvas());
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