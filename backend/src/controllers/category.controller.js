const Category = require('../models/category.model');

const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find({});

    res.status(200).json({
      success: true,
      data: categories,
    });
  } catch (error) {
    next(error);
  }
};

const getCategoryBySlug = async (req, res, next) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getCategories,
  getCategoryBySlug,
};
