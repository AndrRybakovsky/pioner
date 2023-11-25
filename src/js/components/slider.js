import Swiper from 'swiper'
import { Navigation, Pagination } from 'swiper/modules';

const el = document.querySelector('.news__slider');

const swiper = new Swiper(el, {
  modules: [Navigation, Pagination],
  slidesPerView: 1,
  loop: true,
  spaceBetween: 20,
  navigation: {
    nextEl: ".news__button--next",
    prevEl: ".news__button--prev",
  },
  breakpoints: {
    577: {
      slidesPerView: 2,
    },
    769: {
      slidesPerView: 3,
    }
  }
});
